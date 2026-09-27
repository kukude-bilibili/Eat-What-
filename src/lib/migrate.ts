import type { Dish, Menu, MenuLibrary, Shop, SpinScope } from '../types'
import { toDish } from './sanitize'

/** 当前 schema 版本（不变式 5） */
export const SCHEMA_VERSION = 2
/** v1 原文备份键（迁移前写入，永不自动清理） */
export const BACKUP_KEY = 'what-to-eat-v1-backup-v1'

export interface MenuLibraryState {
  schemaVersion: number
  libraries: MenuLibrary[]
  shops: Shop[]
  menus: Menu[]
  userDishes: Dish[]
  spinMenu: SpinScope
  migration: { warnings: string[]; done: boolean }
}

export interface MigrateOutcome {
  state: MenuLibraryState
  warnings: string[]
}

/**
 * v1 → v2 纯迁移（无副作用，备份由调用方先写存储）。
 * - 建 lib_default / menu_personal（kind='personal'，评审定稿）
 * - 每条 customDish → dish_{旧id} + legacyId + menuId，过 toDish；脏数据计数进 warnings
 * - onlyMine=true → spinMenu='mine'
 */
export function migrateV1toV2(persisted: unknown, now = Date.now()): MigrateOutcome {
  const warnings: string[] = []
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>

  const libraries: MenuLibrary[] = [
    { id: 'lib_default', name: '我的菜库', kind: 'personal', createdAt: now, updatedAt: now },
  ]
  const menus: Menu[] = [
    {
      id: 'menu_personal',
      libraryId: 'lib_default',
      title: '我的菜库',
      shopId: null,
      kind: 'personal',
      source: 'manual',
      migratedFrom: 'customDishes',
      updatedAt: now,
    },
  ]

  let kept = 0
  let dropped = 0
  const userDishes: Dish[] = []
  const rawList = Array.isArray(p.customDishes) ? p.customDishes : []
  for (const raw of rawList) {
    const legacyId = typeof (raw as Record<string, unknown>)?.id === 'string'
      ? ((raw as Record<string, unknown>).id as string)
      : ''
    const dish = toDish(raw)
    if (!dish) {
      dropped++
      continue
    }
    userDishes.push({
      ...dish,
      id: `dish_${dish.id}`,
      legacyId: legacyId || undefined,
      menuId: 'menu_personal',
      updatedAt: now,
    })
    kept++
  }
  if (dropped > 0) warnings.push(`迁移时丢弃 ${dropped} 条无法修复的旧数据（原文在备份里）`)
  if (kept > 0) warnings.unshift(`已把 ${kept} 道自己的菜迁移到「我的菜库」`)

  const spinMenu: SpinScope = p.onlyMine === true ? 'mine' : 'all'

  return {
    state: {
      schemaVersion: SCHEMA_VERSION,
      libraries,
      shops: [],
      menus,
      userDishes,
      spinMenu,
      migration: { warnings, done: true },
    },
    warnings,
  }
}

/**
 * 存储守卫（纯函数）：检测已存 payload 的 schema 版本。
 * 返回 'higher' 表示本地数据来自更高版本实现——拒写不覆盖。
 */
export function detectStoredVersion(raw: string | null): 'empty' | 'ok' | 'higher' | 'unreadable' {
  if (!raw) return 'empty'
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; state?: { schemaVersion?: unknown } }
    const version = typeof parsed.version === 'number' ? parsed.version : undefined
    const inner = parsed.state?.schemaVersion
    const innerVersion = typeof inner === 'number' ? inner : undefined
    if (
      (version != null && version > SCHEMA_VERSION) ||
      (innerVersion != null && innerVersion > SCHEMA_VERSION)
    )
      return 'higher'
    return 'ok'
  } catch {
    return 'unreadable'
  }
}
