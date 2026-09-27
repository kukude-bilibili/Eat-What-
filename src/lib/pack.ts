import type { Dish, Menu, MenuPackV2, Shop } from '../types'
import { toDish, toMenu, toShop } from './sanitize'

const PACK_HEADER_V1 = 'EATWHAT-PACK-V1'
const PACK_HEADER_V2 = 'EATWHAT-PACK-V2'

export interface PackParseResult {
  /** 解析结果统一形态：v2 结构（v1 包自动包装成单菜单结构） */
  libraryName?: string
  from?: string
  shops: Shop[]
  menus: Menu[]
  dishes: Dish[]
  /** 解析/修复过程的问题（脏菜丢弃、缺店铺补占位等） */
  warnings: string[]
  error?: string
}

/** 导出 V2 菜单包（带库/菜单/店铺结构） */
export function exportPackV2(
  menus: Menu[],
  dishes: Dish[],
  shops: Shop[],
  libraryName: string,
  from?: string,
): string {
  const payload: MenuPackV2 = {
    pack: PACK_HEADER_V2,
    ...(from ? { from } : {}),
    libraryName,
    shops,
    menus,
    dishes,
    schemaVersion: 2,
  }
  return JSON.stringify(payload)
}

/** 导出 V1 拍平兼容包：老版本用户也能收（丢菜单/店铺结构，保菜品字段） */
export function exportPackV1Flat(dishes: Dish[]): string {
  return JSON.stringify({
    pack: PACK_HEADER_V1,
    dishes: dishes.map(({ name, scenes, price, spicy, type, tags, blurb, meals }) => ({
      name,
      scenes,
      price,
      spicy,
      type,
      tags,
      blurb,
      meals,
    })),
  })
}

interface PackV2Raw {
  pack: typeof PACK_HEADER_V2
  from?: unknown
  libraryName?: unknown
  shops?: unknown
  menus?: unknown
  dishes?: unknown
  schemaVersion?: unknown
}

const emptyResult = (error: string): PackParseResult => ({
  shops: [],
  menus: [],
  dishes: [],
  warnings: [],
  error,
})

/**
 * 统一入口：V1 菜品数组包 / V2 结构包都能解析。
 * 全量走 sanitize；引用完整性：缺店铺的店铺菜单自动补占位 Shop，悬空菜的 menuId 重挂到首菜单。
 * id 全部重映射，防与本地数据碰撞。
 */
export function parsePack(text: string, now = Date.now()): PackParseResult {
  let obj: unknown
  try {
    obj = JSON.parse(text.trim())
  } catch {
    return emptyResult('内容解析失败，确认复制的是完整菜单包')
  }
  const o = obj as Record<string, unknown>
  const pack = o?.pack

  // ── V1：纯菜品数组 → 归入一个 personal 菜单 ──
  if (pack === PACK_HEADER_V1) {
    const warnings: string[] = []
    const dishes = (Array.isArray(o.dishes) ? o.dishes : [])
      .map((d, i) => {
        const parsed = toDish(d)
        if (!parsed && d && typeof d === 'object') warnings.push(`有 1 条无法识别的旧数据被跳过`)
        return parsed ? { ...parsed, id: `p${now}-${i}` } : null
      })
      .filter((d): d is Dish => d !== null)
    if (dishes.length === 0) return emptyResult('包里没有有效菜品')
    const menu: Menu = {
      id: `menu_p${now}`,
      libraryId: 'lib_default',
      title: '导入的菜单包',
      shopId: null,
      kind: 'personal',
      source: 'pack',
      updatedAt: now,
    }
    const withMenu = dishes.map((d) => ({ ...d, menuId: menu.id }))
    if (warnings.length) warnings.unshift(`导入 ${withMenu.length} 道菜，部分旧数据有问题`)
    return { shops: [], menus: [menu], dishes: withMenu, warnings }
  }

  // ── V2：结构包 ──
  if (pack === PACK_HEADER_V2) {
    const warnings: string[] = []
    const v2 = o as unknown as PackV2Raw
    const shops = (Array.isArray(v2.shops) ? v2.shops : [])
      .map((s, i) => {
        const parsed = toShop(s)
        if (!parsed && s && typeof s === 'object') warnings.push('有 1 条店铺数据无效被跳过')
        return parsed ? { ...parsed, id: `shop_${now}_${i}` } : null
      })
      .filter((s): s is Shop => s !== null)
    const shopIdMap = new Map<string, string>()
    // 原 id → 新 id 的映射需要在 toShop 之外拿原始 id：重扫一遍原始数组
    const rawShops = Array.isArray(v2.shops) ? (v2.shops as Record<string, unknown>[]) : []
    rawShops.forEach((s, i) => {
      const oldId = typeof s?.id === 'string' ? s.id : ''
      if (oldId) shopIdMap.set(oldId, `shop_${now}_${i}`)
    })

    const rawMenus = Array.isArray(v2.menus) ? (v2.menus as Record<string, unknown>[]) : []
    const menuIdMap = new Map<string, string>()
    const menus: Menu[] = []
    rawMenus.forEach((m, i) => {
      const oldId = typeof m?.id === 'string' ? m.id : ''
      const newId = oldId ? `menu_${now}_${i}` : `menu_${now}_${i}`
      if (oldId) menuIdMap.set(oldId, newId)
      const parsed = toMenu({ ...m, libraryId: 'lib_default' })
      if (!parsed) {
        warnings.push('有 1 份菜单数据无效被跳过（其下菜品将挂到首份菜单）')
        return
      }
      // 店铺菜单引用完整性：shopId 重映射；映射后仍不存在 → 自动补占位店铺
      let shopId: string | null = null
      if (parsed.kind === 'shop' && parsed.shopId) {
        const mapped = shopIdMap.get(parsed.shopId)
        if (mapped && shops.some((s) => s.id === mapped)) {
          shopId = mapped
        } else {
          const placeholder: Shop = {
            id: `shop_${now}_ph${i}`,
            libraryId: 'lib_default',
            name: parsed.title,
            category: '其他',
            source: 'user',
            updatedAt: now,
          }
          shops.push(placeholder)
          shopId = placeholder.id
          warnings.push(`菜单「${parsed.title}」缺少店铺信息，已自动补占位店铺`)
        }
      }
      menus.push({ ...parsed, id: newId, libraryId: 'lib_default', shopId })
    })
    if (menus.length === 0) {
      menus.push({
        id: `menu_${now}_f`,
        libraryId: 'lib_default',
        title: '导入的菜单包',
        shopId: null,
        kind: 'personal',
        source: 'pack',
        updatedAt: now,
      })
    }

    const dishes = (Array.isArray(v2.dishes) ? v2.dishes : [])
      .map((d, i) => {
        const parsed = toDish(d)
        if (!parsed && d && typeof d === 'object') warnings.push('有 1 条菜品数据无效被跳过')
        return parsed ? { ...parsed, id: `p${now}_${i}` } : null
      })
      .filter((d): d is Dish => d !== null)
      .map((d) => {
        // 菜的 menuId 重映射；悬空则挂首菜单
        const oldMenuId = d.menuId ?? ''
        const mapped = oldMenuId ? menuIdMap.get(oldMenuId) : undefined
        return { ...d, menuId: mapped ?? menus[0].id }
      })

    const from = typeof v2.from === 'string' ? v2.from.slice(0, 20) : undefined
    const libraryName =
      typeof v2.libraryName === 'string' ? v2.libraryName.slice(0, 24) : undefined
    return {
      ...(from ? { from } : {}),
      ...(libraryName ? { libraryName } : {}),
      shops,
      menus,
      dishes,
      warnings,
    }
  }

  return emptyResult('这不是今天吃啥的菜单包')
}
