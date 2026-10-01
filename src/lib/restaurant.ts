import type { Shop, ShopCategory } from '../types'
import { secureInt } from './random'

/**
 * 餐馆转盘的筛选与选取（纯函数，可测）。
 * 结果导向 = 去哪家餐馆；口味类判断（辣度/忌口）属于店内摇菜层，不在这里。
 */

export interface RestaurantFilters {
  /** 品类筛选：all = 不限 */
  category: 'all' | ShopCategory
  /** 避开最近去过的餐馆（软约束：池子 < 3 时自动放宽并记 note） */
  recent: string[]
}

export interface RestaurantPick {
  shop: Shop | null
  poolSize: number
  /** 放宽/降级说明，转盘页如实展示 */
  notes: string[]
}

/** 品类筛选 + 避开最近（软：池子剩 <3 家时自动不避开，调用方据此提示） */
export function filterRestaurants(
  pool: Shop[],
  f: RestaurantFilters,
): { shops: Shop[]; recentApplied: boolean } {
  let out = pool
  if (f.category !== 'all') out = out.filter((s) => s.category === f.category)
  let recentApplied = f.recent.length === 0
  if (f.recent.length > 0) {
    const kept = out.filter((s) => !f.recent.includes(s.name))
    if (kept.length >= 3 || kept.length === out.length) {
      out = kept
      recentApplied = true
    }
  }
  return { shops: out, recentApplied }
}

/** 从筛选后的池子里随机选一家；池子为空时返回 null（调用方给兜底提示） */
export function pickRestaurant(pool: Shop[], f: RestaurantFilters): RestaurantPick {
  const notes: string[] = []
  const full = pool
  const { shops: filtered, recentApplied } = filterRestaurants(pool, f)
  let candidates = filtered
  if (!recentApplied) notes.push('池子太小，本次没避开最近去过的')

  // 品类筛选后为空 → 放宽品类（如实记录），总比转不出来强
  if (candidates.length === 0 && f.category !== 'all') {
    notes.push(`「${f.category}」周边暂时没找到，放宽了品类`)
    candidates = pool
  }

  if (candidates.length === 0) {
    if (full.length === 0) return { shop: null, poolSize: 0, notes }
    // 理论上到不了这里（品类已放宽），保险兜底
    notes.push('筛选后没有可选，已回退全部')
    candidates = full
  }

  const shop = candidates[secureInt(candidates.length)]
  return { shop: shop ?? null, poolSize: candidates.length, notes }
}

/** 预算筛选（可选）：有人均数据的餐馆才参与比较，没有的不淘汰 */
export function filterByBudget(pool: Shop[], budget: number | null): Shop[] {
  if (budget == null) return pool
  return pool.filter((s) => s.cost == null || s.cost <= budget)
}
