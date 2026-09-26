import { expect, it } from 'vitest'
import { clampStr, toDish, toDishList, toHistory, toPerson, toPersonList } from '../sanitize'

const okDish = {
  name: '麻辣拌',
  scenes: ['食堂'],
  price: 15,
  spicy: 2,
  type: '麻辣烫冒菜',
  tags: ['猪肉'],
  blurb: '香',
}

it('toDish：合法数据通过并补默认 id 与 custom 标记', () => {
  const d = toDish(okDish)
  expect(d).not.toBeNull()
  expect(d!.name).toBe('麻辣拌')
  expect(d!.custom).toBe(true)
  expect(d!.id).toBeTruthy()
})

it('toDish：非对象/缺名字/缺场景 → 整体丢弃', () => {
  expect(toDish(null)).toBeNull()
  expect(toDish('面')).toBeNull()
  expect(toDish({ ...okDish, name: '   ' })).toBeNull()
  expect(toDish({ ...okDish, scenes: [] })).toBeNull()
  expect(toDish({ ...okDish, scenes: ['月球'] })).toBeNull()
})

it('toDish：截断超长名字并剥离控制字符', () => {
  const d = toDish({ ...okDish, name: '一'.repeat(50) + '\u0007' })
  expect(d!.name.length).toBe(30)
  expect(d!.name.includes('\u0007')).toBe(false)
})

it('toDish：越界数值封顶、非法枚举回退默认', () => {
  const d = toDish({ ...okDish, price: 8888, spicy: 9, type: '国宴' })
  expect(d!.price).toBe(999)
  expect(d!.spicy).toBe(3)
  expect(d!.type).toBe('小吃')
})

it('toDishList：上限 200 道并剔除脏项', () => {
  const list = Array.from({ length: 300 }, (_, i) => ({ ...okDish, name: `菜${i}` }))
  expect(toDishList(list)).toHaveLength(200)
  expect(toDishList([okDish, null, { name: '没场景', scenes: [] }])).toHaveLength(1)
})

it('toPerson：昵称截断、数值封顶、枚举白名单', () => {
  const p = toPerson(
    { name: 'x'.repeat(99), budget: -5, spicy: '能吃辣', avoid: ['瞎写', '吃素'], likes: ['面食'] },
    '1号',
  )
  expect(p.name).toBe('x'.repeat(12))
  expect(p.budget).toBe(0)
  expect(p.spicy).toBe(3)
  expect(p.avoid).toEqual(['吃素'])
  expect(p.likes).toEqual(['面食'])
})

it('toPersonList：超员截断到 8 人', () => {
  const people = Array.from({ length: 12 }, (_, i) => ({ name: `${i}号` }))
  expect(toPersonList(people)).toHaveLength(8)
})

it('toHistory：丢无名项、封顶 10 条、非法场景回退', () => {
  const h = toHistory([
    { name: '', scene: '食堂' },
    { name: '麻酱拌面', scene: '火星', date: '9/26' },
  ])
  expect(h).toHaveLength(1)
  expect(h[0]).toMatchObject({ name: '麻酱拌面', scene: '食堂', date: '9/26' })
  expect(toHistory(Array.from({ length: 30 }, (_, i) => ({ name: `菜${i}` })))).toHaveLength(10)
})

it('clampStr：非字符串返回空串', () => {
  expect(clampStr(123, 5)).toBe('')
  expect(clampStr(undefined, 5)).toBe('')
})
