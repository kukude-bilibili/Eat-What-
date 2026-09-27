import { useEffect, useMemo, useState } from 'react'
import { makeReason, pickHeader, pickWarmLine } from '../lib/reason'
import { secureFloat } from '../lib/random'
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
  const { outcome, mode, single, groupPeople, respinCount, startSpin, goHome, menus, shops } =
    useAppStore()
  const [copied, setCopied] = useState(false)
  const [header] = useState(() => pickHeader())
  const [warm] = useState(() => pickWarmLine())

  // 摇中的小震动（移动端，设备不支持则静默）
  useEffect(() => {
    try {
      navigator.vibrate?.([60, 40, 60])
    } catch {
      /* 不支持震动 */
    }
  }, [])

  if (!outcome) return null

  // 凑不齐：展示冲突最小的兜底候选
  if (outcome.fallback) {
    return (
      <div className="pt-12 text-center">
        <div className="animate-pop-in text-5xl">😰</div>
        <h1 className="mt-3 font-display text-2xl">实在凑不齐了</h1>
        <p className="mt-1 text-sm text-stone-500">你们的要求加起来太狠了，这三道冲突最小：</p>
        <div className="mt-6 space-y-3 text-left">
          {outcome.candidates.map((d, i) => (
            <div key={d.id} className="sticker-flat flex items-center gap-3 px-4 py-3">
              <span className="badge-pop flex h-7 w-7 items-center justify-center font-display text-xs">
                {i + 1}
              </span>
              <div>
                <div className="font-display text-base">{d.name}</div>
                <div className="mt-0.5 text-xs text-stone-400">
                  {d.blurb} · 人均{d.price}元
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={goHome}
          className="btn-pop font-display mt-8 rounded-2xl bg-[var(--sun)] px-8 py-3 text-lg"
        >
          回首页重新选
        </button>
      </div>
    )
  }

  const dish = outcome.result!
  const people = mode === 'single' ? [single] : groupPeople
  const reason = makeReason(dish, people, outcome.relaxed)
  const menu = dish.menuId ? menus.find((m) => m.id === dish.menuId) : undefined
  const shop = menu?.shopId ? shops.find((sp) => sp.id === menu.shopId) : undefined

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(dish.name)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用（如非 https），静默失败 */
    }
  }

  return (
    <div className="relative pt-10 text-center">
      <Confetti />
      <p className="font-display text-base text-[var(--primary-deep)]">{header}</p>

      {/* 今日饭票 */}
      <div className="sticker relative mx-auto mt-5 max-w-sm">
        {/* 骑缝孔 */}
        <span className="absolute -left-[9px] top-[104px] h-4 w-4 rounded-full border-2 border-[var(--ink)] bg-[var(--paper)]" />
        <span className="absolute -right-[9px] top-[104px] h-4 w-4 rounded-full border-2 border-[var(--ink)] bg-[var(--paper)]" />

        <div className="rounded-t-[0.9rem] border-b-2 border-[var(--ink)] bg-[var(--primary)] py-1.5 text-center">
          <span className="font-display text-xs tracking-[0.4em] text-white">今日饭票 · MEAL TICKET</span>
        </div>

        <div className="px-5 pb-4 pt-4">
          <div className="animate-pop-in text-5xl">🎉</div>
          <h1 className="mt-2 animate-pop-in font-display text-4xl leading-tight">{dish.name}</h1>
          <p className="mt-1.5 text-sm text-stone-500">{dish.blurb}</p>
          {menu && (
            <p className="mt-2 text-xs text-stone-400">
              来自 {menu.title}
              {shop ? ` · ${shop.category}${shop.hours ? ` · ${shop.hours}` : ''}` : ''}
            </p>
          )}
        </div>

        <div className="border-t-2 border-dashed border-[rgba(63,42,26,0.3)] px-5 py-3 text-left">
          <p className="text-xs leading-relaxed text-stone-600">{reason}</p>
          <p className="mt-1.5 text-[11px] text-stone-400">{warm}</p>
        </div>

        {/* 印章 */}
        <span className="animate-stamp absolute -right-2 top-16 rounded-full border-[2.5px] border-[var(--primary)] bg-[var(--card)] px-2.5 py-1.5 font-display text-xs text-[var(--primary)]">
          摇中就认
        </span>
      </div>

      <div className="mt-7 flex justify-center gap-3.5">
        <button
          type="button"
          onClick={copy}
          className="btn-pop rounded-2xl bg-[var(--card)] px-5 py-3 font-bold"
        >
          {copied ? '✅ 已复制' : '📋 复制菜名'}
        </button>
        <button
          type="button"
          onClick={goHome}
          className="btn-pop font-display rounded-2xl bg-[var(--primary)] px-6 py-3 text-lg text-white"
        >
          🍚 就吃它
        </button>
      </div>

      {/* 单人模式专属后悔药：重摇会自动避开刚摇出的菜 */}
      {mode === 'single' && (
        <div className="mx-auto mt-4 w-full max-w-xs">
          <button
            type="button"
            onClick={() => startSpin(true)}
            className="btn-pop font-display w-full rounded-2xl bg-[var(--sun)] py-3.5 text-lg"
          >
            🔄 看到就不想吃？再来一次
          </button>
          {respinCount > 0 && (
            <p className="mt-2.5 font-display text-xs text-stone-400">
              天意已被你改了 {respinCount} 次{respinCount >= 3 ? '，这次真的要认了' : ''}
            </p>
          )}
        </div>
      )}

      <p className="mt-5 font-display text-xs text-stone-400">
        {mode === 'single' ? '一人吃饭，偶尔任性可以理解' : '摇中就认，好日子要坚定'}
      </p>
    </div>
  )
}
