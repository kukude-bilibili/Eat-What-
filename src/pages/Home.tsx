import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SCHOOL_NAME, SEARCH_RADIUS_M } from '../lib/amap'

export default function Home() {
  const {
    restaurants,
    restaurantsLoading,
    restaurantsError,
    restaurantsFromCache,
    loadRestaurants,
    setMode,
    setView,
    history,
  } = useAppStore()

  // 首次进入自动拉取（优先 7 天缓存）
  useEffect(() => {
    loadRestaurants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (url: string) => setView(url as never)

  return (
    <div className="page animate-fade-up">
      <header className="mb-7 text-center">
        <div className="mb-2 animate-bounce-soft text-5xl">🍽️</div>
        <h1 className="text-3xl font-black tracking-wide text-stone-800">去哪家吃</h1>
        <p className="mt-1 text-sm text-stone-500">
          {SCHOOL_NAME} 周边 {SEARCH_RADIUS_M / 1000}km · 摇一摇定餐馆
        </p>
      </header>

      {/* 学校锚点卡 */}
      <div className="sticker-flat mb-6 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-base">📍 {SCHOOL_NAME}</div>
            <div className="mt-0.5 text-xs text-stone-400">
              {restaurantsLoading
                ? '正在拉取周边餐馆…'
                : restaurantsError
                  ? restaurantsError
                  : `已收录周边餐馆 ${restaurants.length} 家${restaurantsFromCache ? '（缓存）' : ''}`}
            </div>
          </div>
          <button
            type="button"
            className="chip shrink-0 text-xs"
            onClick={() => loadRestaurants(true)}
            disabled={restaurantsLoading}
          >
            {restaurantsLoading ? '⏳' : '🔄 刷新'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setMode('single')
            setView('wheel')
          }}
          disabled={restaurants.length === 0}
          className="btn-pop font-display w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white shadow-lg shadow-orange-200 transition-all active:scale-95 disabled:opacity-45"
        >
          🎡 摇一家餐馆
          <span className="ml-2 text-xs font-normal opacity-80">{restaurants.length} 家候选</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('single')
            setView('setup')
          }}
          className="btn-pop font-display w-full rounded-2xl bg-[var(--sun)] py-4 text-lg text-stone-800 shadow-lg shadow-yellow-200 transition-all active:scale-95"
        >
          ⚙️ 先筛一筛（品类/避开最近）
        </button>
      </div>

      {history.length > 0 && (
        <div className="sticker-flat mt-8 px-4 py-3">
          <p className="font-display text-sm">🕘 最近摇到过</p>
          <div className="mt-1 divide-y divide-dashed divide-[rgba(63,42,26,0.18)]">
            {history.slice(0, 3).map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 text-sm text-stone-600"
              >
                <span>{h.name}</span>
                <span className="text-xs text-stone-400">{h.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => go('library')}
        className="mx-auto mt-8 block text-sm text-stone-400 underline underline-offset-4"
      >
        📖 菜单库（各店的菜 + 菜单包分享）
      </button>

      <p className="mt-6 text-center text-xs text-stone-300">
        餐馆数据来自高德 POI · 缓存 7 天 · 手动添加会标"我的"
      </p>
    </div>
  )
}
