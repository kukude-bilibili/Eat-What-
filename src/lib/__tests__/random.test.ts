import { expect, it } from 'vitest'
import { secureFloat, secureInt, secureShuffle } from '../random'

it('secureInt 落在 [0, n) 且始终为整数', () => {
  for (let round = 0; round < 100; round++) {
    for (const n of [1, 2, 3, 7, 100]) {
      const v = secureInt(n)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(n)
      expect(Number.isInteger(v)).toBe(true)
    }
  }
})

it('secureInt 大样本分布均匀（不塌缩到单点）', () => {
  const counts = new Map<number, number>()
  for (let i = 0; i < 2000; i++) {
    const v = secureInt(5)
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  expect(counts.size).toBe(5)
  // 均匀分布期望每桶约 400，给足波动空间
  for (const c of counts.values()) expect(c).toBeGreaterThan(200)
})

it('secureInt 拒绝非正数与非整数', () => {
  expect(() => secureInt(0)).toThrow(RangeError)
  expect(() => secureInt(-3)).toThrow(RangeError)
  expect(() => secureInt(1.5)).toThrow(RangeError)
})

it('secureFloat 落在 [0, 1)', () => {
  for (let i = 0; i < 500; i++) {
    const f = secureFloat()
    expect(f).toBeGreaterThanOrEqual(0)
    expect(f).toBeLessThan(1)
  }
})

it('secureShuffle：不改原数组、保持元素多重集、全同元素不炸', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8]
  const snapshot = [...src]
  const out = secureShuffle(src)
  expect(src).toEqual(snapshot)
  expect([...out].sort((a, b) => a - b)).toEqual(snapshot)
  expect(secureShuffle([9, 9, 9])).toEqual([9, 9, 9])
})
