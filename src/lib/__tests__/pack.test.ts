import { expect, it } from 'vitest'
import { toDish } from '../sanitize'
import { exportPack, parsePack } from '../pack'

const dishA = toDish({
  name: '三食堂二楼麻辣拌',
  scenes: ['食堂'],
  price: 15,
  spicy: 2,
  type: '麻辣烫冒菜',
  tags: ['猪肉'],
  blurb: '阿姨手不抖',
})

it('导出 → 导入 round-trip 保真', () => {
  const text = exportPack([dishA!])
  const r = parsePack(text)
  expect(r.error).toBeUndefined()
  expect(r.dishes).toHaveLength(1)
  expect(r.dishes[0]).toMatchObject({
    name: '三食堂二楼麻辣拌',
    price: 15,
    spicy: 2,
    type: '麻辣烫冒菜',
    custom: true,
  })
})

it('非包文本 / 缺包标记 / 空包都报错', () => {
  expect(parsePack('随便一段话').error).toBeTruthy()
  expect(parsePack(JSON.stringify({ dishes: [] })).error).toBeTruthy()
  expect(parsePack(JSON.stringify({ pack: 'EATWHAT-PACK-V1', dishes: [{ name: '  ' }] })).error).toBeTruthy()
})

it('包里的脏菜被清洗丢弃，有效的留下', () => {
  const r = parsePack(
    JSON.stringify({
      pack: 'EATWHAT-PACK-V1',
      dishes: [
        { name: '   ' },
        { name: '好菜', scenes: ['食堂'], price: 10, spicy: 0, type: '盖饭', tags: ['素'] },
      ],
    }),
  )
  expect(r.error).toBeUndefined()
  expect(r.dishes).toHaveLength(1)
  expect(r.dishes[0].name).toBe('好菜')
})
