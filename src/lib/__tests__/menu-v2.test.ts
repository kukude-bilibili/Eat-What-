import { expect, it } from 'vitest'
import { BUILTIN_DISHES } from '../../data/dishes'
import { MIN_POOL } from '../match'
import { detectStoredVersion, migrateV1toV2 } from '../migrate'
import { buildSpinSource, toDish, validateLibraryState } from '../sanitize'

// ── migrateV1toV2：v1 → v2 纯迁移 ───────────────────

it('v1 fixture 迁移：字段无损、legacyId 保留、归入 personal 菜单', () => {
  const v1 = {
    customDishes: [
      { id: 'c1', name: '麻辣拌', scenes: ['食堂'], price: 15, spicy: 2, type: '麻辣烫冒菜', tags: ['猪肉'], blurb: '香' },
      { id: 'c2', name: '汉堡', scenes: ['外卖'], price: 18, spicy: 0, type: '汉堡炸鸡', tags: ['鸡肉'], blurb: '快' },
    ],
    onlyMine: true,
  }
  const { state, warnings } = migrateV1toV2(v1, 1000)

  expect(state.libraries).toHaveLength(1)
  expect(state.libraries[0]).toMatchObject({ id: 'lib_default', kind: 'personal' })
  expect(state.menus).toHaveLength(1)
  expect(state.menus[0]).toMatchObject({
    id: 'menu_personal',
    kind: 'personal',
    shopId: null,
    migratedFrom: 'customDishes',
  })
  expect(state.userDishes).toHaveLength(2)
  expect(state.userDishes[0]).toMatchObject({
    id: 'dish_c1',
    legacyId: 'c1',
    menuId: 'menu_personal',
    name: '麻辣拌',
  })
  // onlyMine=true → spinMenu='mine'
  expect(state.spinMenu).toBe('mine')
  expect(state.migration.done).toBe(true)
  expect(warnings.some((w) => w.includes('2 道自己的菜'))).toBe(true)
})

it('脏数据：迁移不抛错，丢弃并记录 warning', () => {
  const v1 = {
    customDishes: [
      { name: '   ' },
      '不是对象',
      { name: '好菜', scenes: ['食堂'], price: 10, spicy: 0, type: '盖饭', tags: ['素'] },
    ],
  }
  const { state, warnings } = migrateV1toV2(v1, 1000)
  expect(state.userDishes).toHaveLength(1)
  expect(state.userDishes[0].name).toBe('好菜')
  expect(warnings.some((w) => w.includes('丢弃 2 条'))).toBe(true)
})

it('幂等性：空输入重复迁移不重复建库/菜单', () => {
  const a = migrateV1toV2({}, 1000)
  const b = migrateV1toV2({}, 2000)
  expect(a.state.libraries).toHaveLength(1)
  expect(b.state.libraries).toHaveLength(1)
  expect(a.state.libraries[0].id).toBe(b.state.libraries[0].id)
  expect(a.state.menus).toHaveLength(1)
  expect(a.state.menus[0].id).toBe(b.state.menus[0].id)
  expect(a.state.userDishes).toEqual([])
  expect(b.state.userDishes).toEqual([])
})

// ── detectStoredVersion：高版本拒载数据保护 ──────────

it('detectStoredVersion：v1 payload=ok，更高版本=higher，垃圾=unreadable', () => {
  expect(detectStoredVersion(null)).toBe('empty')
  expect(detectStoredVersion(JSON.stringify({ state: { schemaVersion: 2 }, version: 2 }))).toBe('ok')
  expect(detectStoredVersion(JSON.stringify({ state: { schemaVersion: 3 }, version: 3 }))).toBe('higher')
  expect(detectStoredVersion(JSON.stringify({ version: 9 }))).toBe('higher')
  expect(detectStoredVersion('not-json{{{')).toBe('unreadable')
})

// ── validateLibraryState：不变式 + 孤儿不丢 ──────────

it('不变式：缺默认库/默认菜单自动补；店铺菜单 shopId 悬空降级 campus', () => {
  const r = validateLibraryState({
    libraries: [],
    shops: [{ id: 'shop_x', libraryId: 'lib_default', name: '华莱士', category: '汉堡炸鸡', source: 'user' }],
    menus: [
      { id: 'menu_s', libraryId: 'lib_default', title: '华莱士（东门店）', shopId: 'shop_x', kind: 'shop', source: 'manual' },
      { id: 'menu_bad', libraryId: 'lib_default', title: '没了店铺的店', shopId: 'shop_gone', kind: 'shop', source: 'manual' },
    ],
    dishes: [],
  })
  expect(r.libraries.some((l) => l.id === 'lib_default')).toBe(true)
  expect(r.menus.some((m) => m.id === 'menu_personal')).toBe(true)
  const bad = r.menus.find((m) => m.id === 'menu_bad')!
  expect(bad.kind).toBe('campus')
  expect(bad.shopId).toBeNull()
  expect(r.warnings.some((w) => w.includes('转为校园菜单'))).toBe(true)
})

it('孤儿菜不丢弃：归入"未分类（恢复）"菜单并提示', () => {
  const r = validateLibraryState({
    libraries: [],
    shops: [],
    menus: [],
    dishes: [{ name: '无主之菜', scenes: ['食堂'], price: 10, spicy: 0, type: '盖饭', tags: ['素'] }],
  })
  const recovered = r.menus.find((m) => m.id === 'menu_recovered')!
  expect(recovered.title).toBe('未分类（恢复）')
  expect(r.dishes[0].menuId).toBe('menu_recovered')
  expect(r.warnings.some((w) => w.includes('未分类'))).toBe(true)
})

// ── buildSpinSource：转盘数据源 ─────────────────────

const builtin = BUILTIN_DISHES.slice(0, 3)
const mine = [
  toDish({ name: '我的菜A', menuId: 'menu_a', scenes: ['食堂'], price: 10, spicy: 0, type: '盖饭', tags: ['素'] })!,
  toDish({ name: '我的菜B', menuId: 'menu_b', scenes: ['外卖'], price: 12, spicy: 1, type: '面食', tags: ['素'] })!,
]

it('buildSpinSource：all=内置+我的；mine=只有我的；指定菜单=过滤', () => {
  expect(buildSpinSource(builtin, mine, 'all').dishes).toHaveLength(builtin.length + 2)
  expect(buildSpinSource(builtin, mine, 'mine').dishes).toHaveLength(2)
  const scoped = buildSpinSource(builtin, mine, 'menu_a')
  expect(scoped.dishes).toHaveLength(1)
  expect(scoped.dishes[0].name).toBe('我的菜A')
})

it('buildSpinSource：选定菜单没菜时回退全部并带提示', () => {
  const r = buildSpinSource(builtin, mine, 'menu_empty')
  expect(r.dishes).toHaveLength(builtin.length + 2)
  expect(r.note).toContain('先摇全部')
})

it('MIN_POOL 常量 = 12（保底宽度契约）', () => {
  expect(MIN_POOL).toBe(12)
})
