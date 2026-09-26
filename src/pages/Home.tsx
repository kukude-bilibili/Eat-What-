import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { MEAL_PREFS, MEAL_EMOJI, SCENES, SCENE_EMOJI, type MealPref, type Scene } from '../types'

/** 每个场景的专属底色（选中态） */
const SCENE_BG: Record<Scene, string> = {
  食堂: '#ffe3c2',
  外卖: '#d9ecf9',
  下馆子: '#fbdcdc',
}

const MEAL_BG: Record<MealPref, string> = {
  不限: '#fffdf6',
  早餐: '#fff1b8',
  夜宵: '#e8e3f9',
}

/** 按当前时钟猜时段 */
function autoMeal(): MealPref {
  const h = new Date().getHours()
  if (h >= 6 && h < 10) return '早餐'
  if (h >= 21 || h < 3) return '夜宵'
  return '不限'
}

export default function Home() {
  const { scene, setScene, meal, setMeal, mealTouched, setMode, setView, history } = useAppStore()

  // 用户没手动调过时段时，按时钟自动感知
  useEffect(() => {
    if (!mealTouched) setMeal(autoMeal(), false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      {/* Hero：转盘上的米饭 + 环绕的筷子面碗 */}
      <header className="relative mb-8 pt-3 text-center">
        <div className="relative mx-auto mb-4 h-24 w-24">
          <div className="absolute inset-0 animate-spin-slow rounded-full border-[3px] border-dashed border-[var(--ink)] opacity-30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="animate-bounce-soft text-6xl drop-shadow-[2px_2px_0_rgba(63,42,26,0.15)]">🍚</span>
          </div>
          <span className="absolute -right-4 -top-1 animate-float text-2xl" style={{ '--r': '14deg' } as React.CSSProperties}>
            🥢
          </span>
          <span
            className="absolute -left-5 top-3 animate-float text-xl"
            style={{ '--r': '-14deg', animationDelay: '.7s' } as React.CSSProperties}
          >
            🍜
          </span>
        </div>
        <h1 className="font-display text-[2.7rem] leading-none tracking-wider">今天吃啥</h1>
        <p className="mt-2.5 inline-block -rotate-1 font-display text-sm text-[var(--primary-deep)]">
          摇一摇，饭点不吵架 · 结果具体到一道菜
        </p>
      </header>

      {/* 场景选择 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="badge-pop px-2.5 py-0.5 font-display text-xs">📍 第 1 步</span>
        <span className="text-xs text-stone-400">现在打算在哪儿吃？</span>
      </div>
      <div className="mb-7 grid grid-cols-3 gap-3">
        {SCENES.map((s) => {
          const on = scene === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setScene(s)}
              className={`flex flex-col items-center gap-1 rounded-2xl border-[2.5px] border-[var(--ink)] py-3.5 transition-all active:scale-95 ${
                on ? '-rotate-1' : 'opacity-65'
              }`}
              style={on ? { background: SCENE_BG[s], boxShadow: '3px 3px 0 var(--ink)' } : { background: 'var(--card)' }}
            >
              <span className="text-[1.7rem]">{SCENE_EMOJI[s]}</span>
              <span className="font-display text-sm">{s}</span>
            </button>
          )
        })}
      </div>

      {/* 模式入口 */}
      {/* 时段 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="badge-pop px-2.5 py-0.5 font-display text-xs">⏰ 第 2 步</span>
        <span className="text-xs text-stone-400">什么时候吃？已按现在时间自动选好</span>
      </div>
      <div className="mb-7 grid grid-cols-3 gap-3">
        {MEAL_PREFS.map((m) => {
          const on = meal === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMeal(m)}
              className={`flex flex-col items-center gap-1 rounded-2xl border-[2.5px] border-[var(--ink)] py-3 transition-all active:scale-95 ${
                on ? 'rotate-1' : 'opacity-65'
              }`}
              style={on ? { background: MEAL_BG[m], boxShadow: '3px 3px 0 var(--ink)' } : { background: 'var(--card)' }}
            >
              <span className="text-[1.5rem]">{MEAL_EMOJI[m]}</span>
              <span className="font-display text-sm">{m === '不限' ? '随时' : m}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setMode('single')
            setView('setup')
          }}
          className="btn-pop font-display w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white"
        >
          🎡 一个人摇
          <span className="ml-1 text-xs font-normal opacity-90">30 秒定生死</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('group')
            setView('group')
          }}
          className="btn-pop font-display w-full rounded-2xl bg-[var(--sun)] py-4 text-xl"
        >
          👯 宿舍一起摇
          <span className="ml-1 text-xs font-normal opacity-80">轮流填需求，凑齐再摇</span>
        </button>
      </div>

      {/* 历史：小票样式 */}
      {history.length > 0 && (
        <div className="sticker-flat mt-9 px-4 py-3">
          <p className="font-display text-sm">🕘 最近摇到过</p>
          <div className="mt-1 divide-y divide-dashed divide-[rgba(63,42,26,0.18)]">
            {history.slice(0, 3).map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-bold">{h.name}</span>
                <span className="text-xs text-stone-400">
                  {SCENE_EMOJI[h.scene]} {h.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setView('library')}
        className="chip mx-auto mt-9 block px-4 py-2 text-sm font-bold"
      >
        📖 菜库管理 · 把你们食堂的菜加进来
      </button>
    </div>
  )
}
