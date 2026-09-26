import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BUILTIN_DISHES } from '../data/dishes'
import { matchDishes, type MatchOutcome } from '../lib/match'
import {
  MAX_PEOPLE,
  toDish,
  toDishList,
  toHistory,
  toPerson,
  toPersonList,
} from '../lib/sanitize'
import { blankPerson, type Dish, type PersonPref, type Scene } from '../types'

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
  single: PersonPref
  groupPeople: PersonPref[]
  outcome: MatchOutcome | null
  editingDish: Dish | null
  customDishes: Dish[]
  history: HistoryItem[]

  setView: (v: View) => void
  setMode: (m: Mode) => void
  setScene: (s: Scene) => void
  setSingle: (p: PersonPref) => void
  setGroupPeople: (p: PersonPref[]) => void
  /** 计算匹配结果：正常进转盘页，凑不齐直接进结果页（兜底候选） */
  startSpin: () => void
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
      single: blankPerson('我'),
      groupPeople: [],
      outcome: null,
      editingDish: null,
      customDishes: [],
      history: [],

      setView: (view) => set({ view }),
      setMode: (mode) => set({ mode }),
      setScene: (scene) => set({ scene }),
      setSingle: (p) => set({ single: toPerson(p, '我') }),
      setGroupPeople: (people) => set({ groupPeople: toPersonList(people) }),

      startSpin: () => {
        const s = get()
        const people = s.mode === 'single' ? [s.single] : s.groupPeople
        const outcome = matchDishes(allDishes(s.customDishes), s.scene, people)
        set({ outcome, view: outcome.fallback ? 'result' : 'wheel' })
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
        })
      },
    },
  ),
)
