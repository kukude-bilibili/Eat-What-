import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BUILTIN_DISHES } from '../data/dishes'
import { matchDishes, type MatchOutcome } from '../lib/match'
import { parsePack } from '../lib/pack'
import { MAX_PEOPLE, clampStr, pickEnum, toDish, toDishList, toHistory, toPerson, toPersonList } from '../lib/sanitize'
import type { DishDraft } from '../lib/ai'
import {
  MEAL_PREFS,
  blankPerson,
  type Dish,
  type MealPref,
  type PersonPref,
  type Scene,
} from '../types'

export { MAX_PEOPLE }

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

interface AppState {
  view: View
  mode: Mode
  scene: Scene
  /** 用餐时段（集体偏好），首页按时钟自动感知，可手动改 */
  meal: MealPref
  /** 用户是否手动调过时段（调过就不再自动感知） */
  mealTouched: boolean
  /** 避开最近摇过/吃过的菜（按本地历史） */
  avoidRecent: boolean
  /** 只摇自己的菜（校园菜单库模式），攒满 6 道后可开 */
  onlyMine: boolean
  single: PersonPref
  groupPeople: PersonPref[]
  outcome: MatchOutcome | null
  /** 单人模式“再来一次”的次数 */
  respinCount: number
  editingDish: Dish | null
  customDishes: Dish[]
  history: HistoryItem[]
  /** 智谱 API Key（BYOK，仅存本机） */
  aiKey: string

  setView: (v: View) => void
  setMode: (m: Mode) => void
  setScene: (s: Scene) => void
  setMeal: (m: MealPref, touched?: boolean) => void
  setAvoidRecent: (v: boolean) => void
  setSingle: (p: PersonPref) => void
  setGroupPeople: (p: PersonPref[]) => void
  /** 计算匹配结果：正常进转盘页，凑不齐直接进结果页（兜底候选）；respin=true 表示单人“再来一次” */
  startSpin: (respin?: boolean) => void
  /** 转盘停稳后调用：记历史、进结果页 */
  finishSpin: () => void
  openDishForm: (d: Dish | null) => void
  saveCustom: (d: Dish) => void
  /** AI 拍菜：把识别草稿按选定场景批量入库（同名去重） */
  saveDraftDishes: (drafts: DishDraft[], scene: Scene) => number
  removeCustom: (id: string) => void
  /** 导入校园菜单包（粘贴文本）：全量清洗 + 同名去重，返回 { 数量, 错误 } */
  importPack: (text: string) => { count: number; error?: string }
  setOnlyMine: (v: boolean) => void
  /** 智谱 API Key（BYOK，只存本机 localStorage） */
  setAiKey: (k: string) => void
  goHome: () => void
}

const allDishes = (custom: Dish[]) => [...BUILTIN_DISHES, ...custom]

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      view: 'home',
      mode: 'single',
      scene: '食堂',
      meal: '不限',
      mealTouched: false,
      avoidRecent: true,
      onlyMine: false,
      single: blankPerson('我'),
      groupPeople: [],
      outcome: null,
      respinCount: 0,
      editingDish: null,
      customDishes: [],
      history: [],
      aiKey: '',

      setView: (view) => set({ view }),
      setMode: (mode) => set({ mode }),
      setScene: (scene) => set({ scene }),
      setMeal: (m, touched = true) =>
        set((s) => ({ meal: m, mealTouched: touched ? true : s.mealTouched })),
      setAvoidRecent: (avoidRecent) => set({ avoidRecent }),
      setSingle: (p) => set({ single: toPerson(p, '我') }),
      setGroupPeople: (people) => set({ groupPeople: toPersonList(people) }),

      startSpin: (respin = false) => {
        const s = get()
        const people = s.mode === 'single' ? [s.single] : s.groupPeople
        const recent = s.avoidRecent ? s.history.slice(0, 8).map((h) => h.name) : []
        const mealSoft = !s.mealTouched
        const useOnlyMine = s.onlyMine && s.customDishes.length > 0
        const source = useOnlyMine ? s.customDishes : allDishes(s.customDishes)
        let outcome = matchDishes(source, s.scene, people, { meal: s.meal, mealSoft, recent })
        // 只摇我们的菜但被场景/时段清空时，回退全库并如实说明
        if (useOnlyMine && outcome.fallback && outcome.candidates.length === 0) {
          outcome = matchDishes(allDishes(s.customDishes), s.scene, people, {
            meal: s.meal,
            mealSoft,
            recent,
          })
          outcome = {
            ...outcome,
            relaxed: ['校园菜单库（这个场景没菜，先摇全库）', ...outcome.relaxed],
          }
        }
        // 重摇别摇回同一道：最多补摇 3 次
        const prev = s.history[0]?.name
        if (respin && prev) {
          for (let t = 0; t < 3 && outcome.result?.name === prev && outcome.pool.length > 1; t++) {
            outcome = matchDishes(source, s.scene, people, {
              meal: s.meal,
              mealSoft,
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

      openDishForm: (d) =>
        set({
          // 内置菜抄一份成自定义草稿（id 在事件期生成，不在渲染期）
          editingDish: d && !d.custom ? { ...d, id: `c${Date.now()}`, custom: true } : d,
          view: 'dishForm',
        }),

      saveDraftDishes: (drafts, scene) => {
        const s = get()
        const incoming = drafts
          .map((d, i) =>
            toDish({
              ...d,
              scenes: [scene],
              id: `c${Date.now()}-${i}`,
              custom: true,
            }),
          )
          .filter((d): d is Dish => d !== null)
        const existing = new Set(s.customDishes.map((x) => x.name))
        const fresh = incoming.filter((d) => !existing.has(d.name))
        set({ customDishes: [...s.customDishes, ...fresh], editingDish: null, view: 'library' })
        return fresh.length
      },

      setAiKey: (k) => set({ aiKey: clampStr(k, 80) }),

      saveCustom: (raw) =>
        set((s) => {
          const d = toDish(raw)
          if (!d) return { view: 'library' } // 脏输入直接拒绝，回列表页
          return {
            customDishes: s.customDishes.some((x) => x.id === d.id)
              ? s.customDishes.map((x) => (x.id === d.id ? d : x))
              : [...s.customDishes, d],
            editingDish: null,
            view: 'library',
          }
        }),

      removeCustom: (id) =>
        set((s) => ({ customDishes: s.customDishes.filter((x) => x.id !== id) })),

      importPack: (text) => {
        const s = get()
        const { dishes, error } = parsePack(text)
        if (error || dishes.length === 0) return { count: 0, error }
        const existing = new Set(s.customDishes.map((x) => x.name))
        const fresh = dishes
          .map((d, i) => ({ ...d, id: `p${Date.now()}-${i}` }))
          .filter((d) => !existing.has(d.name))
        set({ customDishes: [...s.customDishes, ...fresh] })
        return { count: fresh.length, error: undefined }
      },

      setOnlyMine: (onlyMine) => set({ onlyMine }),

      goHome: () => set({ view: 'home', outcome: null }),
    }),
    {
      name: 'what-to-eat-v1',
      version: 1,
      partialize: (s) => ({
        single: s.single,
        groupPeople: s.groupPeople,
        customDishes: s.customDishes,
        history: s.history,
        scene: s.scene,
        mode: s.mode,
        meal: s.meal,
        mealTouched: s.mealTouched,
        avoidRecent: s.avoidRecent,
        onlyMine: s.onlyMine,
        aiKey: s.aiKey,
      }),
      // 回读后统一清洗（清洗规则见 src/lib/sanitize.ts）
      onRehydrateStorage: () => (state) => {
        if (!state) return
        useAppStore.setState({
          single: toPerson(state.single, '我'),
          groupPeople: toPersonList(state.groupPeople),
          customDishes: toDishList(state.customDishes),
          history: toHistory(state.history),
          scene: state.scene === '外卖' || state.scene === '下馆子' ? state.scene : '食堂',
          meal: pickEnum<MealPref>(state.meal, MEAL_PREFS, '不限'),
          mealTouched: state.mealTouched === true,
          avoidRecent: state.avoidRecent !== false,
          onlyMine: state.onlyMine === true,
          aiKey: clampStr(state.aiKey, 80),
        })
      },
    },
  ),
)
