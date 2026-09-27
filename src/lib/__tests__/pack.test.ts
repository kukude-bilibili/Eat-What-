import { expect, it } from 'vitest'
import { toDish, toMenu, toShop } from '../sanitize'
import { exportPackV1Flat, exportPackV2, parsePack } from '../pack'

const dishA = toDish({
  name: '三食堂二楼麻辣拌',
  menuId: 'menu_personal',
  scenes: ['食堂'],
  price: 15,
  spicy: 2,
  type: '麻辣烫冒菜',
  tags: ['猪肉'],
  blurb: '阿姨手不抖',
})

it('V1 拍平包：导出 → 导入 round-trip 保真（归入导入菜单）', () => {
  const text = exportPackV1Flat([dishA!])
  const r = parsePack(text)
  expect(r.error).toBeUndefined()
  expect(r.menus).toHaveLength(1)
  expect(r.dishes).toHaveLength(1)
  expect(r.dishes[0]).toMatchObject({
    name: '三食堂二楼麻辣拌',
    price: 15,
    spicy: 2,
    type: '麻辣烫冒菜',
    custom: true,
  })
  // V1 包的菜自动挂到导入生成的菜单上
  expect(r.dishes[0].menuId).toBe(r.menus[0].id)
})

it('V2 结构包：导出 → 导入 round-trip，id 全部重映射', () => {
  const menu = toMenu({
    id: 'menu_old1',
    libraryId: 'lib_default',
    title: '二食堂·3F·麻辣香锅窗口',
    shopId: null,
    kind: 'campus',
    source: 'manual',
  })
  const shop = toShop({
    id: 'shop_old1',
    libraryId: 'lib_default',
    name: '华莱士（东门店）',
    category: '汉堡炸鸡',
    hours: '10:00-22:00',
    source: 'user',
  })
  const shopMenu = toMenu({
    id: 'menu_old2',
    libraryId: 'lib_default',
    title: '华莱士（东门店）',
    shopId: 'shop_old1',
    kind: 'shop',
    source: 'manual',
  })
  const dishInWindow = toDish({
    name: '香锅',
    menuId: 'menu_old1',
    scenes: ['食堂'],
    price: 20,
    spicy: 2,
    type: '麻辣烫冒菜',
    tags: ['猪肉'],
  })
  const dishInShop = toDish({
    name: '汉堡',
    menuId: 'menu_old2',
    scenes: ['外卖'],
    price: 18,
    spicy: 0,
    type: '汉堡炸鸡',
    tags: ['鸡肉'],
  })
  const text = exportPackV2(
    [menu!, shopMenu!],
    [dishInWindow!, dishInShop!],
    [shop!],
    '测试校园',
    '测试员',
  )
  const r = parsePack(text)
  expect(r.error).toBeUndefined()
  expect(r.menus).toHaveLength(2)
  expect(r.shops).toHaveLength(1)
  expect(r.dishes).toHaveLength(2)

  // id 全部重映射（不再包含 old 前缀的原始 id）
  expect(r.menus.every((m) => !m.id.includes('menu_old'))).toBe(true)
  expect(r.shops.every((s) => !s.id.includes('shop_old'))).toBe(true)

  // 结构保真：校园菜单 shopId 为空；店铺菜单挂到重映射后的店铺
  const importedWindow = r.menus.find((m) => m.title === '二食堂·3F·麻辣香锅窗口')!
  expect(importedWindow.kind).toBe('campus')
  expect(importedWindow.shopId).toBeNull()

  const importedShopMenu = r.menus.find((m) => m.title === '华莱士（东门店）')!
  expect(importedShopMenu.kind).toBe('shop')
  expect(r.shops.some((s) => s.id === importedShopMenu.shopId)).toBe(true)

  // 菜的 menuId 指向重映射后的菜单
  const importedHamburger = r.dishes.find((d) => d.name === '汉堡')!
  expect(importedHamburger.menuId).toBe(importedShopMenu.id)
  expect(r.from).toBe('测试员')
  expect(r.libraryName).toBe('测试校园')
})

it('V2 引用完整性：缺店铺时自动补占位店铺', () => {
  const r = parsePack(
    JSON.stringify({
      pack: 'EATWHAT-PACK-V2',
      schemaVersion: 2,
      menus: [
        {
          id: 'menu_x',
          libraryId: 'lib_default',
          title: '神秘小店',
          shopId: 'shop_missing',
          kind: 'shop',
          source: 'manual',
        },
      ],
      dishes: [],
    }),
  )
  expect(r.error).toBeUndefined()
  expect(r.shops).toHaveLength(1)
  expect(r.shops[0].name).toBe('神秘小店')
  expect(r.menus[0].shopId).toBe(r.shops[0].id)
})

it('非包文本报错', () => {
  expect(parsePack('随便一段话').error).toBeTruthy()
})
