import {
  AVOID_OPTIONS,
  DISH_TYPES,
  SCENES,
  SHOP_CATEGORIES,
  TAG_OPTIONS,
  type AvoidOption,
  type Dish,
  type DishType,
  type Menu,
  type MenuLibrary,
  type PersonPref,
  type Scene,
  type Shop,
} from '../types'

/** 宿舍一起摇的人数上限（产品规则） */
export const MAX_PEOPLE = 8

/*
 * 数据清洗（数据接缝）：
 * localStorage 可被用户/插件任意改写，且回读数据可能来自旧版本。
 * 所有"外部进来的数据"（回读、用户输入）统一过这里：
 * 类型/枚举白名单 + 数值封顶 + 字符串截断 + 控制字符过滤。
 * 脏数据要么被修复为合法默认值，要么整体丢弃（返回 null），绝不带病进入应用。
 */

// oxlint-disable-next-line no-control-regex -- 这里就是要匹配并清除控制字符
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/** 去控制字符、去首尾空白、截断长度 */
export function clampStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(CONTROL_CHARS, '').trim().slice(0, max) : ''
}

/** 只接受白名单枚举值，否则回退默认 */
export function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

/** 数值封顶（四舍五入到整数） */
export function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : fallback
}

/** 整数封顶 */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback
  return Math.min(Math.max(n, min), max)
}

/** 校验并规范化一道菜；名字缺失或无场景的脏数据返回 null（整体丢弃） */
export function toDish(v: unknown): Dish | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = clampStr(o.name, 30)
  const scenes = Array.isArray(o.scenes)
    ? o.scenes.filter((s): s is Scene => SCENES.includes(s as Scene))
    : []
  if (!name || scenes.length === 0) return null
  return {
    id: clampStr(o.id, 40) || `c${Date.now()}`,
    name,
    scenes,
    price: clampNum(o.price, 1, 999, 15),
    spicy: clampInt(o.spicy, 0, 3, 0) as Dish['spicy'],
    type: pickEnum<DishType>(o.type, DISH_TYPES, '小吃'),
    tags: Array.isArray(o.tags)
      ? o.tags.filter((t): t is (typeof TAG_OPTIONS)[number] =>
          TAG_OPTIONS.includes(t as (typeof TAG_OPTIONS)[number]),
        )
      : [],
    blurb: clampStr(o.blurb, 50) || '自己加的菜',
    custom: true,
    ...(clampStr(o.menuId, 40) ? { menuId: clampStr(o.menuId, 40) } : {}),
    ...(clampStr(o.legacyId, 40) ? { legacyId: clampStr(o.legacyId, 40) } : {}),
    ...(typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt)
      ? { updatedAt: o.updatedAt }
      : {}),
  }
}

/** 校验并规范化一批自定义菜（上限 200 道） */
export function toDishList(v: unknown): Dish[] {
  if (!Array.isArray(v)) return []
  return v
    .slice(0, 200)
    .map(toDish)
    .filter((d): d is Dish => d !== null)
}

/** 校验并规范化一个人的需求 */
export function toPerson(v: unknown, fallbackName: string): PersonPref {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    name: clampStr(o.name, 12) || fallbackName,
    budget: o.budget == null ? null : clampNum(o.budget, 0, 999, 20),
    spicy: clampInt(o.spicy, 0, 3, 3),
    avoid: Array.isArray(o.avoid)
      ? o.avoid.filter((a): a is AvoidOption => AVOID_OPTIONS.includes(a as AvoidOption))
      : [],
    likes: Array.isArray(o.likes)
      ? o.likes.filter((l): l is DishType => DISH_TYPES.includes(l as DishType))
      : [],
  }
}

/** 校验一批人的需求（上限 MAX_PEOPLE，昵称缺失按序号补） */
export function toPersonList(v: unknown): PersonPref[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, MAX_PEOPLE).map((p, i) => toPerson(p, `${i + 1}号`))
}

export interface HistoryEntry {
  name: string
  scene: Scene
  date: string
}

/** 校验历史记录（上限 10 条，无名字的丢弃） */
export function toHistory(v: unknown): HistoryEntry[] {
  if (!Array.isArray(v)) return []
  return v
    .slice(0, 10)
    .map((h) => (h && typeof h === 'object' ? (h as Record<string, unknown>) : {}))
    .flatMap((o) => {
      const name = clampStr(o.name, 30)
      if (!name) return []
      return [{ name, scene: pickEnum<Scene>(o.scene, SCENES, '食堂'), date: clampStr(o.date, 12) }]
    })
}

/* ── 菜单库 v2 校验层 ─────────────────────────────── */

const ID_MAX = 40

export function toLibrary(v: unknown): MenuLibrary | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const id = clampStr(o.id, ID_MAX)
  const name = clampStr(o.name, 24)
  if (!id || !name) return null
  const kind = pickEnum<MenuLibrary['kind']>(o.kind, ['personal', 'campus', 'offcampus'], 'personal')
  const createdAt = clampInt(o.createdAt, 0, Number.MAX_SAFE_INTEGER, Date.now())
  return { id, name, kind, createdAt, updatedAt: clampInt(o.updatedAt, 0, Number.MAX_SAFE_INTEGER, createdAt) }
}

export function toShop(v: unknown): Shop | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const id = clampStr(o.id, ID_MAX)
  const libraryId = clampStr(o.libraryId, ID_MAX)
  const name = clampStr(o.name, 24)
  if (!id || !libraryId || !name) return null
  const location =
    o.location && typeof o.location === 'object'
      ? (() => {
          const l = o.location as Record<string, unknown>
          const lat = typeof l.lat === 'number' ? l.lat : Number.NaN
          const lng = typeof l.lng === 'number' ? l.lng : Number.NaN
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined
          return {
            lat,
            lng,
            ...(clampStr(l.address, 60) ? { address: clampStr(l.address, 60) } : {}),
            ...(typeof l.distanceM === 'number' && Number.isFinite(l.distanceM)
              ? { distanceM: clampInt(l.distanceM, 0, 100000, 0) }
              : {}),
          }
        })()
      : undefined
  return {
    id,
    libraryId,
    name,
    category: pickEnum<Shop['category']>(o.category, SHOP_CATEGORIES, '其他'),
    ...(location ? { location } : {}),
    ...(clampStr(o.hours, 30) ? { hours: clampStr(o.hours, 30) } : {}),
    source: pickEnum<Shop['source']>(o.source, ['poi', 'user'], 'user'),
    ...(clampStr(o.sourceRef, 40) ? { sourceRef: clampStr(o.sourceRef, 40) } : {}),
    updatedAt: clampInt(o.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
  }
}

export function toMenu(v: unknown): Menu | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const id = clampStr(o.id, ID_MAX)
  const libraryId = clampStr(o.libraryId, ID_MAX)
  const title = clampStr(o.title, 30)
  if (!id || !libraryId || !title) return null
  const shopId = clampStr(o.shopId, ID_MAX) || null
  // 不变式 1：kind='shop' ⇔ shopId 非空；personal/campus ⇔ shopId 为 null
  let kind = pickEnum<Menu['kind']>(o.kind, ['personal', 'campus', 'shop'], 'campus')
  if (kind === 'shop' && !shopId) kind = 'campus'
  if (kind !== 'shop' && shopId) kind = 'shop'
  return {
    id,
    libraryId,
    title,
    shopId,
    kind,
    source: pickEnum<Menu['source']>(o.source, ['manual', 'ai-scan', 'pack', 'poi'], 'manual'),
    ...(o.migratedFrom === 'customDishes' ? { migratedFrom: 'customDishes' as const } : {}),
    updatedAt: clampInt(o.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()),
  }
}

export interface ValidatedLibrary {
  libraries: MenuLibrary[]
  shops: Shop[]
  menus: Menu[]
  /** 全部挂在有效菜单上的菜（孤儿菜进恢复菜单） */
  dishes: Dish[]
  /** 清洗/修复过程的问题记录，UI 可展示 */
  warnings: string[]
}

export const RECOVERED_MENU_ID = 'menu_recovered'
export const DEFAULT_LIBRARY_ID = 'lib_default'

/**
 * 菜单库整体校验（不变式 2 + 孤儿不丢策略）：
 * - 菜引用不存在的库 → 修复为默认库
 * - 店铺菜单的 shopId 悬空 → 降级为 campus（标题保留店铺名，信息不丢）
 * - 孤儿菜 → 归入"未分类（恢复）"菜单 + warning
 * - 孤儿 Shop → 保留（无引用不影响展示）
 */
export function validateLibraryState(
  raw: { libraries: unknown; shops: unknown; menus: unknown; dishes: unknown },
  now = Date.now(),
): ValidatedLibrary {
  const warnings: string[] = []

  const libraries = (Array.isArray(raw.libraries) ? raw.libraries : [])
    .map(toLibrary)
    .filter((l): l is MenuLibrary => l !== null)
    .slice(0, 20)
  if (!libraries.some((l) => l.id === DEFAULT_LIBRARY_ID)) {
    libraries.unshift({
      id: DEFAULT_LIBRARY_ID,
      name: '我的菜库',
      kind: 'personal',
      createdAt: now,
      updatedAt: now,
    })
  }
  const libraryIds = new Set(libraries.map((l) => l.id))

  const shops = (Array.isArray(raw.shops) ? raw.shops : [])
    .map(toShop)
    .filter((s): s is Shop => s !== null)
    .slice(0, 200)
    .map((s) => (libraryIds.has(s.libraryId) ? s : { ...s, libraryId: DEFAULT_LIBRARY_ID }))

  const shopIds = new Set(shops.map((s) => s.id))
  const menus = (Array.isArray(raw.menus) ? raw.menus : [])
    .map(toMenu)
    .filter((m): m is Menu => m !== null)
    .slice(0, 100)
    .map((m) => {
      let fixed = libraryIds.has(m.libraryId) ? m : { ...m, libraryId: DEFAULT_LIBRARY_ID }
      // 店铺菜单 shopId 悬空 → 降级为 campus（标题保留，信息不丢）
      if (fixed.kind === 'shop' && !shopIds.has(fixed.shopId as string)) {
        warnings.push(`菜单「${fixed.title}」的店铺已不存在，已转为校园菜单`)
        fixed = { ...fixed, kind: 'campus', shopId: null }
      }
      return fixed
    })
  if (!menus.some((m) => m.id === 'menu_personal')) {
    menus.unshift({
      id: 'menu_personal',
      libraryId: DEFAULT_LIBRARY_ID,
      title: '我的菜库',
      shopId: null,
      kind: 'personal',
      source: 'manual',
      migratedFrom: 'customDishes',
      updatedAt: now,
    })
  }
  const menuIds = new Set(menus.map((m) => m.id))

  const recoveredTitle = '未分类（恢复）'
  let recovered: Menu | null = menus.find((m) => m.id === RECOVERED_MENU_ID) ?? null
  const dishes: Dish[] = []
  for (const rawDish of Array.isArray(raw.dishes) ? raw.dishes.slice(0, 400) : []) {
    const d = toDish(rawDish)
    if (!d) continue
    if (d.menuId && menuIds.has(d.menuId)) {
      dishes.push(d)
      continue
    }
    // 孤儿菜：归入恢复菜单，不丢弃
    if (!recovered) {
      recovered = {
        id: RECOVERED_MENU_ID,
        libraryId: DEFAULT_LIBRARY_ID,
        title: recoveredTitle,
        shopId: null,
        kind: 'personal',
        source: 'manual',
        updatedAt: now,
      }
      menus.push(recovered)
      menuIds.add(RECOVERED_MENU_ID)
      warnings.push('发现无法归属的菜，已放入「未分类（恢复）」菜单')
    }
    dishes.push({ ...d, menuId: RECOVERED_MENU_ID })
  }

  return { libraries, shops, menus, dishes, warnings }
}

/**
 * 转盘数据源（不变式 3：产出纯 Dish 数组，匹配器不感知 Menu/Shop）。
 * 返回带 note：当选定菜单没菜时由 store 决定降级策略。
 */
export function buildSpinSource(
  builtin: Dish[],
  userDishes: Dish[],
  spinMenu: 'all' | 'mine' | string,
): { dishes: Dish[]; note?: string } {
  if (spinMenu === 'all') return { dishes: [...builtin, ...userDishes] }
  if (spinMenu === 'mine') {
    return userDishes.length > 0
      ? { dishes: userDishes }
      : { dishes: [...builtin, ...userDishes], note: '你的菜单还没菜，先摇全部' }
  }
  const scoped = userDishes.filter((d) => d.menuId === spinMenu)
  if (scoped.length > 0) return { dishes: scoped }
  return { dishes: [...builtin, ...userDishes], note: '所选菜单还没菜，先摇全部' }
}
