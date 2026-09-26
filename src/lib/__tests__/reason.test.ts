import { expect, it } from 'vitest'
import { BUILTIN_DISHES } from '../../data/dishes'
import { blankPerson } from '../../types'
import { makeReason, pickHeader, pickWarmLine } from '../reason'

it('多人全匹配时，理由说明所有人的条件都对上了', () => {
  const r = makeReason(BUILTIN_DISHES[0], [blankPerson('1号'), blankPerson('2号')], [])
  expect(r).toContain('都对上了')
})

it('发生放宽时，理由如实说明放宽了什么', () => {
  const r = makeReason(BUILTIN_DISHES[0], [blankPerson('我')], ['辣度'])
  expect(r).toContain('放宽了辣度')
})

it('单人时使用单人话术', () => {
  const r = makeReason(BUILTIN_DISHES[0], [blankPerson('我')], [])
  expect(r).toContain('替你筛好')
})

it('pickHeader / pickWarmLine 反复调用都返回非空文案', () => {
  for (let i = 0; i < 20; i++) {
    expect(pickHeader().length).toBeGreaterThan(0)
    expect(pickWarmLine().length).toBeGreaterThan(0)
  }
})
