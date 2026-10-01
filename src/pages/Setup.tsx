import { useAppStore } from '../store/useAppStore'
import { PageHeader } from '../components/PageHeader'
import { SHOP_CATEGORIES } from '../types'
import { SEARCH_RADIUS_M, SCHOOL_NAME } from '../lib/amap'

export default function Setup() {
  const {
    restaurantCategory,
    setRestaurantCategory,
    avoidRecent,
    setAvoidRecent,
    restaurants,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    setView,
  } = useAppStore()

  const countOf = (c: string) =>
    c === 'all' ? restaurants.length : restaurants.filter((r) => r.category === c).length

  return (
    <div>
      <PageHeader
        title="先筛一筛"
        sub={`${SCHOOL_NAME} 周边 ${SEARCH_RADIUS_M / 1000}km`}
        onBack={() => setView('home')}
      />

      <div className="sticker-flat mb-4 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-sm">📡 周边餐馆数据</div>
            <div className="mt-0.5 text-xs text-stone-400">
              {restaurantsLoading
                ? '拉取中…'
                : restaurantsError
                  ? restaurantsError
                  : `${restaurants.length} 家（高德 POI + 手动添加）`}
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

      <div className="sticker-flat mb-4 px-4 py-3">
        <div className="mb-2 font-display text-sm">🍜 品类</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`chip ${restaurantCategory === 'all' ? 'chip-on' : ''}`}
            onClick={() => setRestaurantCategory('all')}
          >
            不限（{countOf('all')}）
          </button>
          {SHOP_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${restaurantCategory === c ? 'chip-on' : ''}`}
              onClick={() => setRestaurantCategory(c)}
            >
              {c}（{countOf(c)}）
            </button>
          ))}
        </div>
      </div>

      <div className="sticker-flat mb-4 flex items-center justify-between px-4 py-3">
        <div>
          <div className="font-display text-sm">🍽 避开最近去过的</div>
          <div className="mt-0.5 text-xs text-stone-400">池子太小时会自动不避开</div>
        </div>
        <button
          type="button"
          onClick={() => setAvoidRecent(!avoidRecent)}
          className={`chip h-9 w-14 shrink-0 text-sm font-bold ${avoidRecent ? 'chip-on' : ''}`}
        >
          {avoidRecent ? '开' : '关'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setView('wheel')}
        disabled={restaurants.length === 0}
        className="btn-pop font-display mt-2 w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white shadow-lg shadow-orange-200 transition-all active:scale-95 disabled:opacity-45"
      >
        🎯 就要这些，去摇
      </button>
      <p className="mt-4 text-center text-xs text-stone-400">
        摇中一家就认——不想吃店里什么，进店再用菜单精挑
      </p>
    </div>
  )
}
