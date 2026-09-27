import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { DishDraft } from '../lib/ai'
import { BUILTIN_DISHES } from '../data/dishes'
import { BACKUP_KEY, detectStoredVersion, migrateV1toV2, SCHEMA_VERSION } from '../lib/migrate'
import { matchDishes, type MatchOutcome } from '../lib/match'
import { parsePack } from '../lib/pack'
import {
  buildSpinSource,
  clampStr,
  pickEnum,
  toDish,
  toHistory,
  toPerson,
  toPersonList,
  validateLibraryState,
} from '../lib/sanitize'
import {
  MEAL_PREFS,
  blankPerson,
  type Dish,
  type MenuLibrary,
  type MealPref,
  type Menu,
  type PersonPref,
  type Scene,
  type Shop,
  type SpinScope,
} from '../types'

export { MAX_PEOPLE } from '../lib/sanitize'

export type View =
  | 'home'
  | 'setup'
  | 'group'
  | 'wheel'
  | 'result'
  | 'library'
  | 'dishForm'
  | 'scanDish'
export type Mode = 'single' | 'group'

export interface HistoryItem {
  name: string
  scene: Scene
  date: string
}

/** persist 持久化键（v2 沿用，版本字段区分 schema） */
export const PERSIST_KEY = 'what-to-eat-v1'
export const DEFAULT_LIBRARY_ID = 'lib_default'
export const PERSONAL_MENU_ID = 'menu_personal'

interface AppState {
  /** schema 版本根标记（不变式 5） */
  schemaVersion: number
  view: View
  mode: Mode
  scene: Scene
  meal: MealPref
  mealTouched: boolean
  avoidRecent: boolean
  /** 转盘库范围：全部 / 我的所有菜单 / 指定菜单 id */
  spinMenu: SpinScope
  /** 本地数据来自更高版本实现时置位：拒写不覆盖，只读内置库 */
  blockedByHigherVersion: boolean
  single: PersonPref
  groupPeople: PersonPref[]
  outcome: MatchOutcome | null
  respinCount: number
  editingDish: Dish | null
  /** 菜单库 v2：库/店铺/菜单/用户菜 */
  libraries: MenuLibrary[]
  shops: Shop[]
  menus: Menu[]
  userDishes: Dish[]
  migration: { warnings: string[]; done: boolean }
  history: HistoryItem[]
  aiKey: string

  setView: (v: View) => void
  setMode: (m: Mode) => void
  setScene: (s: Scene) => void
  setMeal: (m: MealPref, touched?: boolean) => void
  setAvoidRecent: (v: boolean) => void
  setSpinMenu: (v: SpinScope) => void
  setSingle: (p: PersonPref) => void
  setGroupPeople: (p: PersonPref[]) => void
  /** 计算匹配结果：正常进转盘页，凑不齐直接进结果页（兜底候选）；respin=true 表示单人"再来一次" */
  startSpin: (respin?: boolean) => void
  finishSpin: () => void
  openDishForm: (d: Dish | null) => void
  saveCustom: (d: Dish) => void
  /** 新建菜单：campus=自由文本标题；shop=店名+品类（同步建 Shop） */
  createMenu: (input: {
    kind: 'campus' | 'shop'
    title: string
    category?: string
    hours?: string
  }) => string | null
  renameMenu: (id: string, title: string) => void
  /** 删菜单：级联删其下菜品；无引用的店铺一并清理 */
  removeMenu: (id: string) => void
  /** AI 拍菜：草稿按 (菜单, 场景) 批量入库（同名去重） */
  saveDraftDishes: (drafts: DishDraft[], scene: Scene, menuId: string) => number
  /** 导入菜单包（V1/V2 统一入口）：返回 { 数量, 错误 } */
  importPack: (text: string) => { count: number; error?: string }
  removeCustom: (id: string) => void
  setAiKey: (k: string) => void
  goHome: () => void
}

/** 有效菜单 id 集合（库校验后的引用） */
function ensureMenuId(menus: Menu[], menuId: string | undefined): string {
  return menuId && menus.some((m) => m.id === menuId) ? menuId : PERSONAL_MENU_ID
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      schemaVersion: SCHEMA_VERSION,
      view: 'home',
      mode: 'single',
      scene: '食堂',
      meal: '不限',
      mealTouched: false,
      avoidRecent: true,
      spinMenu: 'all',
      blockedByHigherVersion: false,
      single: blankPerson('我'),
      groupPeople: [],
      outcome: null,
      respinCount: 0,
      editingDish: null,
      libraries: [
        {
          id: DEFAULT_LIBRARY_ID,
          name: '我的菜库',
          kind: 'personal',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      shops: [],
      menus: [
        {
          id: PERSONAL_MENU_ID,
          libraryId: DEFAULT_LIBRARY_ID,
          title: '我的菜库',
          shopId: null,
          kind: 'personal',
          source: 'manual',
          migratedFrom: 'customDishes',
          updatedAt: Date.now(),
        },
      ],
      userDishes: [],
      migration: { warnings: [], done: false },
      history: [],
      aiKey: '',

      setView: (view) => set({ view }),
      setMode: (mode) => set({ mode }),
      setScene: (scene) => set({ scene }),
      setMeal: (m, touched = true) =>
        set((s) => ({ meal: m, mealTouched: touched ? true : s.mealTouched })),
      setAvoidRecent: (avoidRecent) => set({ avoidRecent }),
      setSpinMenu: (spinMenu) => set({ spinMenu }),
      setSingle: (p) => set({ single: toPerson(p, '我') }),
      setGroupPeople: (people) => set({ groupPeople: toPersonList(people) }),

      startSpin: (respin = false) => {
        const s = get()
        const people = s.mode === 'single' ? [s.single] : s.groupPeople
        const recent = s.avoidRecent ? s.history.slice(0, 8).map((h) => h.name) : []
        const { dishes: source, note } = buildSpinSource(
          BUILTIN_DISHES,
          s.userDishes,
          s.spinMenu,
        )
        let outcome = matchDishes(source, s.scene, people, { meal: s.meal, recent })
        if (note) outcome = { ...outcome, relaxed: [note, ...outcome.relaxed] }
        // 重摇别摇回同一道：最多补摇 3 次
        const prev = s.history[0]?.name
        if (respin && prev) {
          for (let t = 0; t < 3 && outcome.result?.name === prev && outcome.pool.length > 1; t++) {
            outcome = matchDishes(source, s.scene, people, {
              meal: s.meal,
              recent: [...recent, prev],
            })
          }
        }
        set({
          outcome,
          respinCount: respin ? s.respinCount + 1 : 0,
          view: outcome.fallback ? 'result' : 'wheel',
        })
      },

      finishSpin: () => {
        const s = get()
        const r = s.outcome?.result
        if (r) {
          const date = new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
          set({ history: [{ name: r.name, scene: s.scene, date }, ...s.history].slice(0, 10) })
        }
        set({ view: 'result' })
      },

      openDishForm: (editingDish) =>
        set({
          editingDish:
            editingDish && !editingDish.custom
              ? { ...editingDish, id: `c${Date.now()}`, custom: true }
              : editingDish,
          view: 'dishForm',
        }),

      saveCustom: (raw) =>
        set((s) => {
          const menuId = ensureMenuId(s.menus, raw.menuId)
          const d = toDish({ ...raw, menuId })
          if (!d) return { view: 'library' } // 脏输入直接拒绝，回列表页
          return {
            userDishes: s.userDishes.some((x) => x.id === d.id)
              ? s.userDishes.map((x) => (x.id === d.id ? { ...d, updatedAt: Date.now() } : x))
              : [...s.userDishes, { ...d, updatedAt: Date.now() }],
            editingDish: null,
            view: 'library',
          }
        }),

      createMenu: (input) => {
        const s = get()
        const now = Date.now()
        if (input.kind === 'campus') {
          const title = input.title.trim().slice(0, 30)
          if (!title) return null
          const id = `menu_${now}`
          set({
            menus: [
              ...s.menus,
              {
                id,
                libraryId: DEFAULT_LIBRARY_ID,
                title,
                shopId: null,
                kind: 'campus',
                source: 'manual',
                updatedAt: now,
              },
            ],
          })
          return id
        }
        const name = input.title.trim().slice(0, 24)
        if (!name) return null
        const shopId = `shop_${now}`
        const id = `menu_${now + 1}`
        set({
          shops: [
            ...s.shops,
            {
              id: shopId,
              libraryId: DEFAULT_LIBRARY_ID,
              name,
              category: (input.category as Shop['category']) ?? '其他',
              ...(input.hours?.trim() ? { hours: input.hours.trim().slice(0, 30) } : {}),
              source: 'user',
              updatedAt: now,
            },
          ],
          menus: [
            ...s.menus,
            {
              id,
              libraryId: DEFAULT_LIBRARY_ID,
              title: name,
              shopId,
              kind: 'shop',
              source: 'manual',
              updatedAt: now,
            },
          ],
        })
        return id
      },

      renameMenu: (id, title) =>
        set((s) => ({
          menus: s.menus.map((m) =>
            m.id === id
              ? { ...m, title: title.trim().slice(0, 30) || m.title, updatedAt: Date.now() }
              : m,
          ),
        })),

      removeMenu: (id) => {
        const s = get()
        if (id === PERSONAL_MENU_ID) return // 默认菜单不可删
        const menu = s.menus.find((m) => m.id === id)
        if (!menu) return
        set({
          menus: s.menus.filter((m) => m.id !== id),
          userDishes: s.userDishes.filter((d) => d.menuId !== id),
          // 店铺无其他菜单引用 → 一并清理
          shops:
            menu.shopId && !s.menus.some((m) => m.id !== id && m.shopId === menu.shopId)
              ? s.shops.filter((sp) => sp.id !== menu.shopId)
              : s.shops,
          ...(s.spinMenu === id ? { spinMenu: 'all' as SpinScope } : {}),
        })
      },

      saveDraftDishes: (drafts, scene, menuId) => {
        const s = get()
        const target = ensureMenuId(s.menus, menuId)
        const incoming = drafts
          .map((d, i) =>
            toDish({
              ...d,
              scenes: [scene],
              menuId: target,
              id: `c${Date.now()}-${i}`,
              custom: true,
            }),
          )
          .filter((d): d is Dish => d !== null)
        const existing = new Set(s.userDishes.map((x) => x.name))
        const fresh = incoming
          .filter((d) => !existing.has(d.name))
          .map((d) => ({ ...d, updatedAt: Date.now() }))
        set({ userDishes: [...s.userDishes, ...fresh], editingDish: null, view: 'library' })
        return fresh.length
      },

      importPack: (text) => {
        const s = get()
        const parsed = parsePack(text)
        if (parsed.error || parsed.dishes.length === 0)
          return { count: 0, error: parsed.error ?? '包里没有有效菜品' }
        // 结构合入：id 已在解析期重映射，无碰撞；菜单/店铺去重按 id
        const menuIds = new Set(s.menus.map((m) => m.id))
        const shopIds = new Set(s.shops.map((x) => x.id))
        const dishNames = new Set(s.userDishes.map((x) => x.name))
        const freshMenus = parsed.menus.filter((m) => !menuIds.has(m.id))
        const freshShops = parsed.shops.filter((sp) => !shopIds.has(sp.id))
        const freshDishes = parsed.dishes.filter((d) => !dishNames.has(d.name))
        set({
          libraries: [
            ...s.libraries,
            ...(!s.libraries.some((l) => l.id === DEFAULT_LIBRARY_ID)
              ? []
              : []),
          ],
          shops: [...s.shops, ...freshShops],
          menus: [...s.menus, ...freshMenus],
          userDishes: [...s.userDishes, ...freshDishes],
        })
        return { count: freshDishes.length, error: undefined }
      },

      removeCustom: (id) =>
        set((s) => ({ userDishes: s.userDishes.filter((x) => x.id !== id) })),

      setAiKey: (k) => set({ aiKey: clampStr(k, 80) }),

      goHome: () => set({ view: 'home', outcome: null }),
    }),
    {
      name: PERSIST_KEY,
      version: SCHEMA_VERSION,
      // 存储守卫：检测到更高 schema 版本的 payload 时拒写不覆盖（评审定稿 4）
      storage: createJSONStorage(() => ({
        getItem: (name: string) =>
          typeof localStorage === 'undefined' ? null : localStorage.getItem(name),
        setItem: (name: string, value: string) => {
          if (name === PERSIST_KEY && detectStoredVersion(localStorage.getItem(name)) === 'higher')
            return
          localStorage.setItem(name, value)
        },
        removeItem: (name: string) => localStorage.removeItem(name),
      })),
      partialize: (s) => ({
        schemaVersion: s.schemaVersion,
        scene: s.scene,
        mode: s.mode,
        meal: s.meal,
        mealTouched: s.mealTouched,
        avoidRecent: s.avoidRecent,
        spinMenu: s.spinMenu,
        single: s.single,
        groupPeople: s.groupPeople,
        libraries: s.libraries,
        shops: s.shops,
        menus: s.menus,
        userDishes: s.userDishes,
        migration: s.migration,
        history: s.history,
        aiKey: s.aiKey,
      }),
      // v1 → v2 迁移（见 docs/schema/menu-library-migration-draft.md）
      migrate: (persisted, version) => {
        if (version > SCHEMA_VERSION) {
          // 高版本：中止回填；存储守卫 + onRehydrate 会置位提示，原数据原地保留
          throw new Error('schema-too-new')
        }
        if (version >= 1) {
          // 迁移前把 v1 原文写入备份键（无损的物理保证）
          try {
            localStorage.setItem(BACKUP_KEY, JSON.stringify(persisted))
          } catch {
            /* 备份失败不阻断迁移 */
          }
          const p = persisted as Record<string, unknown>
          const m = migrateV1toV2(p)
          return {
            ...p,
            ...m.state,
            // 清源：v2 状态不再有 v1 散装字段
            customDishes: undefined,
            onlyMine: undefined,
          }
        }
        return persisted
      },
      onRehydrateStorage: () => (state, _error) => {
        // 高版本数据保护（评审定稿 4）：检测到更高 schemaVersion → 拒写不覆盖 + 置位提示
        const raw =
          typeof localStorage !== 'undefined' ? localStorage.getItem(PERSIST_KEY) : null
        const tooNew = detectStoredVersion(raw) === 'higher'
        if (tooNew) useAppStore.setState({ blockedByHigherVersion: true })
        if (!state) return
        const patch: Partial<AppState> = {
          single: toPerson(state.single, '我'),
          groupPeople: toPersonList(state.groupPeople),
          history: toHistory(state.history),
          scene: state.scene === '外卖' || state.scene === '下馆子' ? state.scene : '食堂',
          meal: pickEnum<MealPref>(state.meal, MEAL_PREFS, '不限'),
          spinMenu: pickEnum<SpinScope>(state.spinMenu, ['all', 'mine'], 'all'),
          aiKey: clampStr(state.aiKey, 80),
        }
        // 菜单库整体校验（不变式 2 + 孤儿不丢）
        const lib = validateLibraryState({
          libraries: state.libraries,
          shops: state.shops,
          menus: state.menus,
          dishes: state.userDishes,
        })
        patch.libraries = lib.libraries
        patch.shops = lib.shops
        patch.menus = lib.menus
        patch.userDishes = lib.dishes
        if (state.migration?.warnings?.length || lib.warnings.length) {
          patch.migration = {
            warnings: [...(state.migration?.warnings ?? []), ...lib.warnings],
            done: true,
          }
        }
        // 菜单引用校验后 spinMenu 可能悬空（菜单被清理）
        if (
          patch.spinMenu &&
          patch.spinMenu !== 'all' &&
          patch.spinMenu !== 'mine' &&
          !patch.menus.some((m) => m.id === patch.spinMenu)
        ) {
          patch.spinMenu = 'all'
        }
        useAppStore.setState(patch)
      },
    },
  ),
)
