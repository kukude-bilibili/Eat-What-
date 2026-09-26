import type { DishType, MealTag } from '../types'
import { DISH_TYPES, TAG_OPTIONS } from '../types'
import { clampInt, clampNum, clampStr, pickEnum } from './sanitize'

/** 视觉识别默认模型：智谱 glm-4v-flash（免费档） */
export const AI_MODEL = 'glm-4v-flash'
export const AI_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
export const AI_KEY_URL = 'https://open.bigmodel.cn/'

const SCAN_PROMPT = `你是食堂菜单识别助手。识别图片里的所有菜品（价目表/窗口灯箱/手写菜单都可以），输出一个 JSON 数组，不要输出任何其他文字或代码块标记：
[{"name":"菜品名","price":数字人均或单价元,"spicy":0到3的整数辣度,"type":"必须是这些之一：盖饭/面食/粉米线/麻辣烫冒菜/火锅烤肉/汉堡炸鸡/日料寿司/韩餐/烧烤/轻食/小吃/硬菜","tags":["只能是：猪肉/牛肉/羊肉/鸡肉/鸭肉/海鲜/鱼/内脏/蛋/素 里的一项或多项，荤素不确定就留空数组"],"meals":["早餐"]或["夜宵"]或[]}]
要求：price 识别不到就填 15；spicy 按菜名常识判断；只输出 JSON 数组本身。`

/** 识别草稿：还没归属场景，入库前由用户选定场景 */
export interface DishDraft {
  name: string
  price: number
  spicy: 0 | 1 | 2 | 3
  type: DishType
  tags: string[]
  meals?: MealTag[]
}

/** 从模型回复里抠出 JSON 数组并清洗成草稿（容忍代码块围栏和前后废话） */
export function parseMenuJson(text: string): DishDraft[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const o = item as Record<string, unknown>
    const name = clampStr(o.name, 30)
    if (!name) return []
    return [
      {
        name,
        price: clampNum(o.price, 1, 999, 15),
        spicy: clampInt(o.spicy, 0, 3, 0) as 0 | 1 | 2 | 3,
        type: pickEnum<DishType>(o.type, DISH_TYPES, '小吃'),
        tags: Array.isArray(o.tags)
          ? o.tags.filter((t): t is (typeof TAG_OPTIONS)[number] =>
              TAG_OPTIONS.includes(t as (typeof TAG_OPTIONS)[number]),
            )
          : [],
        meals: Array.isArray(o.meals)
          ? (o.meals.filter((m): m is MealTag => m === '早餐' || m === '夜宵') as MealTag[])
          : undefined,
      },
    ]
  })
}

export interface ScanResult {
  drafts: DishDraft[]
  error?: string
}

/** 拍照识别菜单：调智谱视觉模型，返回打标好的菜品草稿 */
export async function scanMenuPhoto(apiKey: string, imageDataUrl: string): Promise<ScanResult> {
  if (!apiKey) return { drafts: [], error: '先在下面填入智谱 API Key' }

  let res: Response
  try {
    res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageDataUrl } },
              { type: 'text', text: SCAN_PROMPT },
            ],
          },
        ],
        temperature: 0.1,
      }),
    })
  } catch {
    return { drafts: [], error: '网络错误：请检查网络，或浏览器插件拦截了请求' }
  }

  if (res.status === 401) return { drafts: [], error: 'API Key 不对，去 open.bigmodel.cn 复制完整的 Key' }
  if (res.status === 429)
    return { drafts: [], error: '请求太频繁了，glm-4v-flash 免费档限流，等几十秒再试' }
  if (!res.ok) return { drafts: [], error: `识别失败（HTTP ${res.status}），换个清楚点的照片试试` }

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = await res.json()
  } catch {
    return { drafts: [], error: '返回内容解析失败，再试一次' }
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  const drafts = parseMenuJson(content)
  if (drafts.length === 0) {
    return { drafts: [], error: '没认出菜品：照片要正对菜单、光线充足，文字别太花' }
  }
  return { drafts }
}

/** 图片压缩：长边 ≤1280px 的 JPEG，控制 base64 体积 */
export async function fileToDataUrl(file: File): Promise<string> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}
