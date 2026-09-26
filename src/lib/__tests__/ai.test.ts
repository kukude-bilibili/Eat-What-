import { expect, it } from 'vitest'
import { parseMenuJson } from '../ai'

it('纯 JSON 数组直接解析', () => {
  const drafts = parseMenuJson(
    '[{"name":"麻辣拌","price":15,"spicy":2,"type":"麻辣烫冒菜","tags":["猪肉"],"meals":[]}]',
  )
  expect(drafts).toHaveLength(1)
  expect(drafts[0]).toMatchObject({ name: '麻辣拌', price: 15, spicy: 2, type: '麻辣烫冒菜' })
})

it('容忍代码块围栏和模型废话', () => {
  const text = `好的，识别结果如下：
\`\`\`json
[{"name":"锅包肉","price":21,"spicy":0,"type":"硬菜","tags":["猪肉"]},{"name":"烤冷面"}]
\`\`\``
  const drafts = parseMenuJson(text)
  expect(drafts).toHaveLength(2)
  expect(drafts[0].name).toBe('锅包肉')
})

it('非 JSON / 非数组 / 空串 → 空结果', () => {
  expect(parseMenuJson('我认不出来')).toEqual([])
  expect(parseMenuJson('{"name":"不是数组"}')).toEqual([])
  expect(parseMenuJson('')).toEqual([])
})

it('脏项丢弃：无名字/非对象跳过，非法枚举回退，数值封顶', () => {
  const drafts = parseMenuJson(
    `[
      {"name":"  ","price":1},
      "不是对象",
      {"name":"某某套餐","price":8888,"spicy":9,"type":"满汉全席","tags":["山珍","素"],"meals":["早餐","下午茶"]}
    ]`,
  )
  expect(drafts).toHaveLength(1)
  expect(drafts[0].name).toBe('某某套餐')
  expect(drafts[0].price).toBe(999)
  expect(drafts[0].spicy).toBe(3)
  expect(drafts[0].type).toBe('小吃')
  expect(drafts[0].tags).toEqual(['素'])
  expect(drafts[0].meals).toEqual(['早餐'])
})
