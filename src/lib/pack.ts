import type { Dish } from '../types'
import { toDish } from './sanitize'

const PACK_HEADER = 'EATWHAT-PACK-V1'

export interface PackResult {
  dishes: Dish[]
  error?: string
}

/** 导出校园菜单包：可读 JSON 文本，微信直接复制粘贴即可传输 */
export function exportPack(dishes: Dish[]): string {
  return JSON.stringify({
    pack: PACK_HEADER,
    exportedAt: new Date().toISOString(),
    dishes: dishes.map(({ name, scenes, price, spicy, type, tags, blurb, meals }) => ({
      name,
      scenes,
      price,
      spicy,
      type,
      tags,
      blurb,
      meals,
    })),
  })
}

/** 导入菜单包：全量走 sanitize 校验，脏数据直接丢弃 */
export function parsePack(text: string): PackResult {
  let obj: { pack?: unknown; dishes?: unknown }
  try {
    obj = JSON.parse(text.trim())
  } catch {
    return { dishes: [], error: '内容解析失败，确认复制的是完整菜单包' }
  }
  if (obj?.pack !== PACK_HEADER || !Array.isArray(obj.dishes)) {
    return { dishes: [], error: '这不是今天吃啥的菜单包' }
  }
  const dishes = obj.dishes
    .map(toDish)
    .filter((d): d is Dish => d !== null)
  if (dishes.length === 0) return { dishes: [], error: '包里没有有效菜品' }
  return { dishes }
}
