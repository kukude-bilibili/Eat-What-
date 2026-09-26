import type { Dish, DishType, PersonPref, Scene } from '../types'
import { SPICY_LABELS } from '../types'
import { secureInt } from './random'

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
 * 多人交集匹配 + 逐级放宽：
 * 完全匹配 → 放宽想吃类型 → 放宽辣度(+1) → 放宽预算(+5元) → 兜底（冲突最小前3）
 */
export function matchDishes(dishes: Dish[], scene: Scene, people: PersonPref[]): MatchOutcome {
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

  // 类型从一开始就没对齐：不限制类型，但要在提示里如实记录
  const relaxed: string[] = []
  if (likesConflict) relaxed.push('想吃类型')

  let typeOn = hasLikes
  let spicyCap: number | null = minSpicy < 3 ? minSpicy : null
  let budgetCap: number | null = minBudget

  const filter = () =>
    base.filter(
      (d) =>
        (!typeOn || likes!.includes(d.type)) &&
        (spicyCap == null || d.spicy <= spicyCap) &&
        (budgetCap == null || d.price <= budgetCap),
    )

  let pool = filter()

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
