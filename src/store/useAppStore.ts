import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BUILTIN_DISHES } from '../data/dishes'
import { matchDishes, type MatchOutcome } from '../lib/match'
import {
  MAX_PEOPLE,
  pickEnum,
  toDish,
  toDishList,
  toHistory,
  toPerson,
  toPersonList,
} from '../lib/sanitize'
import {
  MEAL_PREFS,
  blankPerson,
  type Dish,
  type MealPref,
  type PersonPref,
  type Scene,
} from '../types'

export { MAX_PEOPLE }

export type View = 'home' | 'setup' | 'group' | 'wheel' | 'result' | 'library' | 'dishForm'
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
  single: PersonPref
  groupPeople: PersonPref[]
  outcome: MatchOutcome | null
  /** 单人模式“再来一次”的次数 */
  respinCount: number
  editingDish: Dish | null
  customDishes: Dish[]
  history: HistoryItem[]

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
  removeCustom: (id: string) => void
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
      single: blankPerson('我'),
      groupPeople: [],
      outcome: null,
      respinCount: 0,
      editingDish: null,
      customDishes: [],
      history: [],

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
        const outcome = matchDishes(allDishes(s.customDishes), s.scene, people, {
          meal: s.meal,
          recent,
        })
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
        })
      },
    },
  ),
)
