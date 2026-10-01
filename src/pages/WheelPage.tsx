import { useEffect, useState } from 'react'
import { Wheel } from '../components/Wheel'
import { pickRestaurant } from '../lib/restaurant'
import { secureInt } from '../lib/random'
import { useAppStore } from '../store/useAppStore'

interface Decided {
  shop: { id: string; name: string }
  poolSize: number
  notes: string[]
  segments: { id: string; name: string }[]
  targetIndex: number
}

export default function WheelPage() {
  const {
    restaurants,
    restaurantCategory,
    avoidRecent,
    history,
    restaurantsLoading,
    restaurantsError,
    loadRestaurants,
    commitRestaurantPick,
    setView,
  } = useAppStore()

  const [decided, setDecided] = useState<Decided | null>(null)

  useEffect(() => {
    loadRestaurants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 数据就绪且尚未决定时：预选餐馆 + 摆转盘扇区（结果必在扇区内）
  useEffect(() => {
    if (decided || restaurants.length === 0 || restaurantsLoading) return
    const recent = avoidRecent ? history.slice(0, 8).map((h) => h.name) : []
    const { shop, poolSize, notes } = pickRestaurant(restaurants, {
      category: restaurantCategory,
      recent,
    })
    if (!shop) return // 空池：走下方空态 UI
    const candidates = [...restaurants]
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = secureInt(i + 1)
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
    const segments = candidates.slice(0, 8).map((s) => ({ id: s.id, name: s.name }))
    if (!segments.some((s) => s.id === shop.id)) segments[0] = { id: shop.id, name: shop.name }
    const targetIndex = segments.findIndex((s) => s.id === shop.id)
    setDecided({ shop, poolSize, notes, segments, targetIndex })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, restaurantsLoading])

  const commit = () => {
    if (!decided) return
    commitRestaurantPick(decided.shop as never, decided.poolSize, decided.notes)
  }

  const spinAgain = () => setDecided(null)

  // ── 状态分支 ──
  if (restaurants.length === 0 || !decided) {
    return (
      <div className="page center">
        <div className="animate-bounce-soft text-5xl">🍽️</div>
        <p className="mt-4 text-sm text-stone-500">
          {restaurantsLoading
            ? '正在拉取周边餐馆…'
            : (restaurantsError ?? '周边餐馆池是空的，去首页刷新或手动添加一家')}
        </p>
        <button type="button" className="chip mt-6" onClick={() => loadRestaurants(true)}>
          🔄 重新拉取
        </button>
        <button type="button" className="chip mt-3" onClick={() => setView('home')}>
          回首页
        </button>
      </div>
    )
  }

  return (
    <div className="page animate-fade-up">
      {decided.notes.length > 0 && (
        <p className="badge-pop mx-auto mb-6 w-fit px-4 py-1.5 text-xs">
          {decided.notes.join('；')}
        </p>
      )}
      <Wheel
        segments={decided.segments}
        targetIndex={decided.targetIndex}
        onDone={commit}
      />
      <p className="page-tip mt-2">候选 {decided.poolSize} 家 · 摇中就认</p>
      <button type="button" className="link-btn" onClick={spinAgain}>
        手滑了，重摆转盘
      </button>
    </div>
  )
}
