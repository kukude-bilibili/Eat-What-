import {
  AVOID_OPTIONS,
  DISH_TYPES,
  SCENES,
  TAG_OPTIONS,
  type AvoidOption,
  type Dish,
  type DishType,
  type PersonPref,
  type Scene,
} from '../types'

/** 宿舍一起摇的人数上限（产品规则） */
export const MAX_PEOPLE = 8

/*
 * 数据清洗（数据接缝）：
 * localStorage 可被用户/插件任意改写，且回读数据可能来自旧版本。
 * 所有"外部进来的数据"（回读、用户输入）统一过这里：
 * 类型/枚举白名单 + 数值封顶 + 字符串截断 + 控制字符过滤。
 * 脏数据要么被修复为合法默认值，要么整体丢弃（返回 null），绝不带病进入应用。
 */

// oxlint-disable-next-line no-control-regex -- 这里就是要匹配并清除控制字符
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/** 去控制字符、去首尾空白、截断长度 */
export function clampStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(CONTROL_CHARS, '').trim().slice(0, max) : ''
}

/** 只接受白名单枚举值，否则回退默认 */
export function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

/** 数值封顶（四舍五入到整数） */
export function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : fallback
}

/** 整数封顶 */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback
  return Math.min(Math.max(n, min), max)
}

/** 校验并规范化一道菜；名字缺失或无场景的脏数据返回 null（整体丢弃） */
export function toDish(v: unknown): Dish | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = clampStr(o.name, 30)
  const scenes = Array.isArray(o.scenes)
    ? o.scenes.filter((s): s is Scene => SCENES.includes(s as Scene))
    : []
  if (!name || scenes.length === 0) return null
  return {
    id: clampStr(o.id, 40) || `c${Date.now()}`,
    name,
    scenes,
    price: clampNum(o.price, 1, 999, 15),
    spicy: clampInt(o.spicy, 0, 3, 0) as Dish['spicy'],
    type: pickEnum<DishType>(o.type, DISH_TYPES, '小吃'),
    tags: Array.isArray(o.tags)
      ? o.tags.filter((t): t is (typeof TAG_OPTIONS)[number] =>
          TAG_OPTIONS.includes(t as (typeof TAG_OPTIONS)[number]),
        )
      : [],
    blurb: clampStr(o.blurb, 50) || '自己加的菜',
    custom: true,
  }
}

/** 校验并规范化一批自定义菜（上限 200 道） */
export function toDishList(v: unknown): Dish[] {
  if (!Array.isArray(v)) return []
  return v
    .slice(0, 200)
    .map(toDish)
    .filter((d): d is Dish => d !== null)
}

/** 校验并规范化一个人的需求 */
export function toPerson(v: unknown, fallbackName: string): PersonPref {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    name: clampStr(o.name, 12) || fallbackName,
    budget: o.budget == null ? null : clampNum(o.budget, 0, 999, 20),
    spicy: clampInt(o.spicy, 0, 3, 3),
    avoid: Array.isArray(o.avoid)
      ? o.avoid.filter((a): a is AvoidOption => AVOID_OPTIONS.includes(a as AvoidOption))
      : [],
    likes: Array.isArray(o.likes)
      ? o.likes.filter((l): l is DishType => DISH_TYPES.includes(l as DishType))
      : [],
  }
}

/** 校验一批人的需求（上限 MAX_PEOPLE，昵称缺失按序号补） */
export function toPersonList(v: unknown): PersonPref[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, MAX_PEOPLE).map((p, i) => toPerson(p, `${i + 1}号`))
}

export interface HistoryEntry {
  name: string
  scene: Scene
  date: string
}

/** 校验历史记录（上限 10 条，无名字的丢弃） */
export function toHistory(v: unknown): HistoryEntry[] {
  if (!Array.isArray(v)) return []
  return v
    .slice(0, 10)
    .map((h) => (h && typeof h === 'object' ? (h as Record<string, unknown>) : {}))
    .flatMap((o) => {
      const name = clampStr(o.name, 30)
      if (!name) return []
      return [{ name, scene: pickEnum<Scene>(o.scene, SCENES, '食堂'), date: clampStr(o.date, 12) }]
    })
}
