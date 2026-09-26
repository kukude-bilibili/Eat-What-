import type { Dish, DishType, MealPref, PersonPref, Scene } from '../types'
import { SPICY_LABELS } from '../types'
import { secureInt } from './random'

/** 池子保底宽度：软约束（自动时段/避开最近）在池子低于它时自动放宽，宁可宽不可窄 */
export const MIN_POOL = 12

export interface MatchOutcome {
  /** 最终可用于转盘的菜品池 */
  pool: Dish[]
  /** 摇中的那道菜（fallback 时为 null） */
  result: Dish | null
  /** 为了凑齐结果放宽了哪些条件 */
  relaxed: string[]
  /** true = 实在凑不齐，走“冲突最小”兜底 */
  fallback: boolean
  /** 兜底候选（冲突最小的前 3 道） */
  candidates: Dish[]
}

export interface MatchOptions {
  /** 用餐时段（集体偏好），不限 = 不过滤 */
  meal?: MealPref
  /** 时段是否为系统自动感知（自动的属于软约束，池子太窄时优先放宽） */
  mealSoft?: boolean
  /** 最近摇过/吃过的菜名，软排除：不会因此把池子掏空 */
  recent?: string[]
}

/** 忌口是否拦截这道菜 */
export function dishBlocked(dish: Dish, avoid: readonly string[]): boolean {
  return avoid.some((a) => {
    if (a === '吃素') return !dish.tags.includes('素')
    if (a === '不吃海鲜') return dish.tags.includes('海鲜') || dish.tags.includes('鱼')
    return dish.tags.includes(a.replace('不吃', ''))
  })
}

/** 想吃类型的交集；null 表示没人填 = 不限 */
function likesIntersection(people: PersonPref[]): DishType[] | null {
  const withLikes = people.filter((p) => p.likes.length > 0)
  if (withLikes.length === 0) return null
  return withLikes.reduce<DishType[]>(
    (acc, p) => acc.filter((t) => p.likes.includes(t)),
    [...withLikes[0].likes],
  )
}

/**
 * 交集匹配 + 分层放宽：
 * 硬约束（场景/忌口/明确设置的辣度预算类型）绝不背叛；
 * 软约束（自动时段/避开最近）在池子窄于保底宽度时自动放宽；
 * 空池保命：任何时候池子为空都继续放宽直到有结果或走兜底。
 */
export function matchDishes(
  dishes: Dish[],
  scene: Scene,
  people: PersonPref[],
  opts: MatchOptions = {},
): MatchOutcome {
  const { meal = '不限', mealSoft = false, recent } = opts

  // 硬层：场景 + 忌口，永不放宽
  const base = dishes.filter(
    (d) => d.scenes.includes(scene) && people.every((p) => !dishBlocked(d, p.avoid)),
  )

  const budgets = people.map((p) => p.budget).filter((b): b is number => b != null)
  const minBudget = budgets.length ? Math.min(...budgets) : null
  const minSpicy = Math.min(...people.map((p) => p.spicy))

  const likes = likesIntersection(people)
  const likesConflict = likes !== null && likes.length === 0
  const hasLikes = likes !== null && likes.length > 0

  // 放宽前记录原始约束，兜底打分用
  const orig = { hasLikes, likes, minSpicy, minBudget }

  const relaxed: string[] = []
  if (likesConflict) relaxed.push('想吃类型')

  const recentSet = new Set(recent ?? [])
  let recentOn = !!(recent && recent.length)
  let typeOn = hasLikes
  let mealTag: '早餐' | '夜宵' | null = meal === '早餐' || meal === '夜宵' ? meal : null
  let spicyCap: number | null = minSpicy < 3 ? minSpicy : null
  let budgetCap: number | null = minBudget

  const filter = () =>
    base.filter(
      (d) =>
        (!recentOn || !recentSet.has(d.name)) &&
        (!typeOn || likes!.includes(d.type)) &&
        (!mealTag || !!d.meals?.includes(mealTag)) &&
        (spicyCap == null || d.spicy <= spicyCap) &&
        (budgetCap == null || d.price <= budgetCap),
    )

  let pool = filter()

  // ── 软约束放宽：池子窄于保底宽度时逐层放开 ──
  // 1) 自动感知的时段（夜宵×食堂这种组合池子太窄的头号元凶）
  if (pool.length < MIN_POOL && mealTag != null && mealSoft) {
    relaxed.push('时段（自动）')
    mealTag = null
    pool = filter()
  }
  // 2) 避开最近吃过的
  if (pool.length < MIN_POOL && recentOn) {
    relaxed.push('避开最近吃过的')
    recentOn = false
    pool = filter()
  }

  // ── 空池保命：任何约束组合空池都继续放宽 ──
  if (pool.length === 0 && mealTag != null) {
    relaxed.push('时段')
    mealTag = null
    pool = filter()
  }
  if (pool.length === 0 && typeOn) {
    relaxed.push('想吃类型')
    typeOn = false
    pool = filter()
  }
  if (pool.length === 0 && spicyCap != null) {
    relaxed.push('辣度')
    spicyCap = Math.min(spicyCap + 1, 3)
    pool = filter()
  }
  if (pool.length === 0 && budgetCap != null) {
    relaxed.push('预算（+5元）')
    budgetCap += 5
    pool = filter()
  }

  if (pool.length === 0) {
    // 兜底：按违反约束的程度打分，冲突最小的前 3 道
    const score = (d: Dish) =>
      (orig.hasLikes && orig.likes ? (orig.likes.includes(d.type) ? 0 : 2) : 0) +
      (orig.minSpicy < 3 && d.spicy > orig.minSpicy ? (d.spicy - orig.minSpicy) * 2 : 0) +
      (orig.minBudget != null && d.price > orig.minBudget
        ? Math.ceil((d.price - orig.minBudget) / 5) * 2
        : 0)
    const candidates = [...base].sort((a, b) => score(a) - score(b)).slice(0, 3)
    return { pool: [], result: null, relaxed, fallback: true, candidates }
  }

  const result = pool[secureInt(pool.length)]
  return { pool, result, relaxed, fallback: false, candidates: [] }
}

/** 多人“共同范围”，用于汇总展示 */
export function commonScope(people: PersonPref[]) {
  const budgets = people.map((p) => p.budget).filter((b): b is number => b != null)
  const minBudget = budgets.length ? Math.min(...budgets) : null
  const minSpicy = Math.min(...people.map((p) => p.spicy))
  const avoidAll = [...new Set(people.flatMap((p) => p.avoid))]
  const likes = likesIntersection(people)
  return {
    budgetLabel: minBudget != null ? `≤ ${minBudget} 元` : '不限',
    spicyLabel: SPICY_LABELS[minSpicy],
    avoidAll,
    likes: likes && likes.length > 0 ? likes : null,
    likesConflict: likes !== null && likes.length === 0,
  }
}
