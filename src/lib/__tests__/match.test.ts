import { expect, it } from 'vitest'
import { BUILTIN_DISHES } from '../../data/dishes'
import { blankPerson, type AvoidOption } from '../../types'
import { commonScope, matchDishes } from '../match'

// ── 单人基础过滤 ────────────────────────────────────

it('单人：结果全部匹配场景、预算与辣度，且转盘结果在池内', () => {
  const me = { ...blankPerson('我'), budget: 20, spicy: 1 }
  const { pool, result } = matchDishes(BUILTIN_DISHES, '食堂', [me])
  expect(pool.length).toBeGreaterThan(0)
  for (const d of pool) {
    expect(d.scenes).toContain('食堂')
    expect(d.price).toBeLessThanOrEqual(20)
    expect(d.spicy).toBeLessThanOrEqual(1)
  }
  expect(pool).toContain(result)
})

it('忌口：不吃海鲜时不出现海鲜和鱼', () => {
  const me = { ...blankPerson('我'), avoid: ['不吃海鲜'] as AvoidOption[] }
  const { pool } = matchDishes(BUILTIN_DISHES, '外卖', [me])
  expect(pool.length).toBeGreaterThan(0)
  for (const d of pool) {
    expect(d.tags).not.toContain('海鲜')
    expect(d.tags).not.toContain('鱼')
  }
})

it('吃素：只出现带"素"标签的菜', () => {
  const me = { ...blankPerson('我'), avoid: ['吃素'] as AvoidOption[] }
  const { pool } = matchDishes(BUILTIN_DISHES, '食堂', [me])
  expect(pool.length).toBeGreaterThan(0)
  for (const d of pool) expect(d.tags).toContain('素')
})

// ── 多人交集 ────────────────────────────────────────

it('多人：预算取最低、辣度取最低、类型取交集', () => {
  const a = { ...blankPerson('1号'), budget: 15, spicy: 0, likes: ['面食' as const] }
  const b = { ...blankPerson('2号'), budget: 25, spicy: 3, likes: ['面食' as const] }
  const { pool } = matchDishes(BUILTIN_DISHES, '食堂', [a, b])
  expect(pool.length).toBeGreaterThan(0)
  for (const d of pool) {
    expect(d.price).toBeLessThanOrEqual(15)
    expect(d.spicy).toBeLessThanOrEqual(0)
    expect(d.type).toBe('面食')
  }
  const scope = commonScope([a, b])
  expect(scope.budgetLabel).toBe('≤ 15 元')
  expect(scope.spicyLabel).toBe('不辣')
})

it('口味没对齐（类型交集为空）时放宽想吃类型并提示', () => {
  const a = { ...blankPerson('1号'), budget: 20, likes: ['火锅烤肉' as const] }
  const b = { ...blankPerson('2号'), budget: 20, likes: ['面食' as const] }
  const { pool, relaxed } = matchDishes(BUILTIN_DISHES, '食堂', [a, b])
  expect(pool.length).toBeGreaterThan(0)
  expect(relaxed).toContain('想吃类型')
})

it('预算凑不齐时逐级放宽 +5 元并提示', () => {
  // 食堂没有 ≤5 元的菜，触发预算放宽
  const me = { ...blankPerson('我'), budget: 5, spicy: 3 }
  const { pool, relaxed } = matchDishes(BUILTIN_DISHES, '食堂', [me])
  expect(pool.length).toBeGreaterThan(0)
  expect(relaxed).toContain('预算（+5元）')
  for (const d of pool) expect(d.price).toBeLessThanOrEqual(10)
})

it('实在凑不齐时走兜底：无结果并给出兜底标记', () => {
  // 下馆子场景里"素且无蛋"的菜为 0 → 基础池为空 → 兜底
  const me = { ...blankPerson('我'), avoid: ['吃素', '不吃蛋'] as AvoidOption[] }
  const { pool, fallback } = matchDishes(BUILTIN_DISHES, '下馆子', [me])
  expect(fallback).toBe(true)
  expect(pool).toHaveLength(0)
})

// ── 需求层 v2：时段 / 避开最近 ──────────────────────

it('时段：早餐只出现早餐档的菜', () => {
  const me = blankPerson('我')
  const { pool } = matchDishes(BUILTIN_DISHES, '食堂', [me], { meal: '早餐' })
  expect(pool.length).toBeGreaterThan(0)
  for (const d of pool) expect(d.meals).toContain('早餐')
})

it('时段在该场景无菜可吃时放宽并提示', () => {
  // 下馆子场景没有早餐档的菜
  const me = blankPerson('我')
  const { pool, relaxed } = matchDishes(BUILTIN_DISHES, '下馆子', [me], { meal: '早餐' })
  expect(pool.length).toBeGreaterThan(0)
  expect(relaxed).toContain('时段')
})

it('避开最近吃过的：刚摇出的菜不再出现', () => {
  const me = blankPerson('我')
  const first = matchDishes(BUILTIN_DISHES, '食堂', [me])
  const name = first.result!.name
  const again = matchDishes(BUILTIN_DISHES, '食堂', [me], { recent: [name] })
  expect(again.pool.every((d) => d.name !== name)).toBe(true)
  // 池子没有被掏空，不该提示
  expect(again.relaxed).not.toContain('避开最近吃过的')
})

it('避开最近会把池子掏空时自动回退并如实提示', () => {
  const me = blankPerson('我')
  const allCanteen = BUILTIN_DISHES.filter((d) => d.scenes.includes('食堂')).map((d) => d.name)
  const { pool, relaxed } = matchDishes(BUILTIN_DISHES, '食堂', [me], { recent: allCanteen })
  expect(pool.length).toBeGreaterThan(0)
  expect(relaxed).toContain('避开最近吃过的')
})

// ── 池子保底（MIN_POOL）：窄池自动放宽软约束 ────────

it('夜宵×食堂是窄池：硬时段保持窄，自动时段放宽到保底以上', () => {
  const me = blankPerson('我')
  // 用户明确选的夜宵：即使窄也保留
  const hard = matchDishes(BUILTIN_DISHES, '食堂', [me], { meal: '夜宵' })
  expect(hard.pool.length).toBeGreaterThan(0)
  expect(hard.pool.length).toBeLessThan(12)
  for (const d of hard.pool) expect(d.meals).toContain('夜宵')
  expect(hard.relaxed).not.toContain('时段（自动）')

  // 系统自动感知的夜宵：池子太窄就放宽，凑出丰富候选
  const soft = matchDishes(BUILTIN_DISHES, '食堂', [me], { meal: '夜宵', mealSoft: true })
  expect(soft.pool.length).toBeGreaterThanOrEqual(12)
  expect(soft.relaxed).toContain('时段（自动）')
})

it('明确设置的硬约束（辣度/预算/类型）不因池子窄而被背叛', () => {
  const me = { ...blankPerson('我'), budget: 15, spicy: 0, likes: ['面食' as const] }
  const { pool, relaxed } = matchDishes(BUILTIN_DISHES, '食堂', [me])
  expect(pool.length).toBeGreaterThan(0)
  for (const d of pool) {
    expect(d.type).toBe('面食')
    expect(d.spicy).toBeLessThanOrEqual(0)
    expect(d.price).toBeLessThanOrEqual(15)
  }
  expect(relaxed).toEqual([])
})
