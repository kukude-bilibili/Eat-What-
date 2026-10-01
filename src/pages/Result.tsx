import { useMemo, useState } from 'react'
import { secureFloat } from '../lib/random'
import { pickHeader, pickWarmLine } from '../lib/reason'
import { useAppStore } from '../store/useAppStore'

const CONFETTI_COLORS = ['#f2542d', '#ffc531', '#63a46c', '#6bb3d6', '#f7a8b8', '#3f2a1a']

/** 撒花：一次性随机好每片的位置颜色 */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: secureFloat() * 100,
        delay: secureFloat() * 0.9,
        duration: 2.4 + secureFloat() * 1.8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: secureFloat() > 0.5,
      })),
    [],
  )
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece ${p.round ? 'h-2.5 w-2.5 rounded-full' : 'h-3.5 w-2'}`}
          style={{
            left: `${p.left}%`,
            background: p.color,
            border: '1.5px solid var(--ink)',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function Result() {
  const { restaurantResult, goHome } = useAppStore()
  const [copied, setCopied] = useState(false)
  const [header] = useState(() => pickHeader())
  const [warm] = useState(() => pickWarmLine())

  if (!restaurantResult) return null
  const { shop, poolSize, notes } = restaurantResult

  const copy = () => {
    navigator.clipboard
      .writeText(shop.name)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => undefined)
  }

  /** 高德导航 URI：免 Key，浏览器/手机均能拉起 */
  const navUrl = shop.location
    ? `https://uri.amap.com/navigation?to=${shop.location.lng},${shop.location.lat},${encodeURIComponent(shop.name)}&mode=car&src=eatwhat&coordinate=gaode&callnative=1`
    : undefined

  return (
    <div className="page center animate-fade-up" style={{ paddingTop: '60rpx' }}>
      <p className="text-sm font-bold text-orange-600">{header}</p>
      <Confetti />

      <div className="sticker ticket">
        <div className="ticket-head">今日饭票 · 去这家吃</div>
        <div className="ticket-body">
          <div className="animate-pop-in text-6xl">🏪</div>
          <h1 className="ticket-dish animate-pop-in">{shop.name}</h1>
          <p className="ticket-blurb">
            {shop.category}
            {shop.rating ? ` · ⭐ ${shop.rating}` : ''}
            {shop.cost ? ` · 人均 ¥${shop.cost}` : ''}
            {shop.location?.distanceM ? ` · ${shop.location.distanceM}m` : ''}
          </p>
          {shop.location?.address && <p className="tiny mt-2">📍 {shop.location.address}</p>}
          {shop.hours && <p className="tiny">🕘 {shop.hours}</p>}
        </div>
        <div className="ticket-reason">
          <p>
            {notes.length > 0
              ? notes.join('；') + `（候选 ${poolSize} 家）。`
              : `从周边 ${poolSize} 家里摇出来的，天意。`}
          </p>
          <p className="ticket-warm">{warm}</p>
        </div>
        <span className="stamp">摇中就认</span>
      </div>

      <div className="result-btns">
        {navUrl && (
          <a
            href={navUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-pop font-display btn-primary"
            style={{ textDecoration: 'none' }}
          >
            🧭 去导航
          </a>
        )}
        <button type="button" onClick={copy} className="btn-pop btn-card">
          {copied ? '✅ 已复制' : '📋 复制店名'}
        </button>
      </div>

      <button
        type="button"
        onClick={goHome}
        className="btn-pop font-display respin-btn btn-sun"
      >
        🍚 就去这家
      </button>
      <p className="page-tip">摇中就认，好日子要坚定</p>
    </div>
  )
}
