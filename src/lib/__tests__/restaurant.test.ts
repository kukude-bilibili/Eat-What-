import { expect, it } from 'vitest'
import { mapPoiCategory, poiToShop } from '../amap'
import { filterByBudget, filterRestaurants, pickRestaurant } from '../restaurant'
import type { Shop } from '../../types'

function shop(name: string, category: Shop['category'], extra: Partial<Shop> = {}): Shop {
  return {
    id: `shop_${name}`,
    libraryId: 'lib_default',
    name,
    category,
    source: 'poi',
    updatedAt: 1000,
    ...extra,
  }
}

// ── POI → Shop 映射 ────────────────────────────────

it('mapPoiCategory：高德 type 关键词映射到 13 项品类', () => {
  expect(mapPoiCategory('餐饮服务;中餐厅;四川菜(川菜)')).toBe('川湘菜')
  expect(mapPoiCategory('餐饮服务;外国餐厅;日本料理')).toBe('日料')
  expect(mapPoiCategory('餐饮服务;快餐厅;小吃')).toBe('快餐')
  expect(mapPoiCategory('购物服务;甜品店')).toBe('甜品烘焙')
  expect(mapPoiCategory('餐饮服务;火锅店')).toBe('火锅')
  expect(mapPoiCategory('不知道什么东西')).toBe('其他')
})

it('poiToShop：正常 POI 映射（location 拆分/地址拼接/字段容错）', () => {
  const poi = {
    id: 'B0FFG12345',
    name: '华莱士（东门店）',
    type: '餐饮服务;快餐厅',
    location: { lng: 110.93, lat: 21.66 },
    pname: '广东省',
    cityname: '茂名市',
    adname: '茂南区',
    address: '官渡一路 1 号',
    tel: '0668-1234567',
    biz_ext: { cost: '18', rating: '4.5', open_time: '10:00-22:00' },
    distance: 1234.5,
  }
  const s = poiToShop(poi, 5000)!
  expect(s).not.toBeNull()
  expect(s.id).toBe('shop_amap_B0FFG12345')
  expect(s.name).toBe('华莱士（东门店）')
  expect(s.category).toBe('快餐')
  expect(s.location?.lat).toBe(21.66)
  expect(s.location?.lng).toBe(110.93)
  expect(s.location?.address).toContain('茂名市')
  expect(s.cost).toBe(18)
  expect(s.rating).toBe('4.5')
  expect(s.hours).toBe('10:00-22:00')
  expect(s.tel).toBe('0668-1234567')
  expect(s.location?.distanceM).toBe(1235)
  expect(s.sourceRef).toBe('B0FFG12345')
  expect(s.updatedAt).toBe(5000)
})

it('poiToShop：缺名字/缺坐标的脏 POI 返回 null；cost 非法容错', () => {
  expect(poiToShop(null)).toBeNull()
  expect(poiToShop({ name: '没坐标' })).toBeNull()
  expect(poiToShop({ name: '有坐标但 cost 乱', location: { lng: 1, lat: 2 }, biz_ext: { cost: '面议' } })?.cost).toBeUndefined()
})

// ── 筛选与选取 ──────────────────────────────────────

const pool = [
  shop('川菜馆', '川湘菜', { cost: 30 }),
  shop('烧烤摊', '烧烤', { cost: 45 }),
  shop('面馆', '面馆', { cost: 12 }),
  shop('奶茶店', '奶茶饮品', { cost: 8 }),
]

it('filterRestaurants：品类过滤生效', () => {
  const out = filterRestaurants(pool, { category: '烧烤', recent: [] })
  expect(out.shops).toHaveLength(1)
  expect(out.shops[0].name).toBe('烧烤摊')
})

it('pickRestaurant：品类没货时放宽并如实提示', () => {
  const r = pickRestaurant(pool, { category: '火锅', recent: [] })
  expect(r.shop).not.toBeNull()
  expect(r.notes.some((n) => n.includes('放宽了品类'))).toBe(true)
})

it('pickRestaurant：避开最近是软约束（池子剩 <3 家时放宽并提示）', () => {
  // 池子 4 家，避开 2 家剩 2 家 <3 → 放宽并提示
  const r = pickRestaurant(pool, { category: 'all', recent: ['川菜馆', '烧烤摊'] })
  expect(r.notes.some((n) => n.includes('没避开最近'))).toBe(true)
  expect(r.shop).not.toBeNull()
})

it('pickRestaurant：避开最近正常生效时不提示', () => {
  const r = pickRestaurant(pool, { category: 'all', recent: ['奶茶店'] })
  expect(r.notes).toEqual([])
  expect(r.shop?.name).not.toBe('奶茶店')
})

it('filterByBudget：无人均数据的不淘汰', () => {
  const out = filterByBudget(pool, 15)
  expect(out.some((s) => s.name === '面馆')).toBe(true) // 12 ≤ 15 ✓
  expect(out.some((s) => s.name === '川菜馆')).toBe(false) // 30 > 15
  expect(out.some((s) => s.name === '奶茶店')).toBe(true) // 8 ≤ 15
})

it('pickRestaurant：空池返回 null', () => {
  expect(pickRestaurant([], { category: 'all', recent: [] }).shop).toBeNull()
})
