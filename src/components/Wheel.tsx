import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dish } from '../types'

/** 复古餐盘色盘 */
const COLORS = ['#ffd166', '#ff8c61', '#9bc995', '#86bbd9', '#f6aac8', '#fff1b8', '#ffc6a8', '#b8e0d2']

interface Props {
  segments: Dish[]
  targetIndex: number
  onDone: () => void
}

/** 复古贴纸转盘：墨色外圈 + 铆钉 + 番茄指针，落到 targetIndex 扇区后回调 onDone */
export function Wheel({ segments, targetIndex, onDone }: Props) {
  const [rotation, setRotation] = useState(0)
  const spinning = rotation === 0
  const doneRef = useRef(false)
  /** transitionend 与兜底定时器只允许一个触发 onDone */
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    setTimeout(onDone, 450)
  }

  const segAngle = 360 / segments.length

  const gradient = useMemo(() => {
    const stops = segments
      .map((_, i) => `${COLORS[i % COLORS.length]} ${i * segAngle}deg ${(i + 1) * segAngle}deg`)
      .join(', ')
    return `conic-gradient(${stops})`
  }, [segments, segAngle])

  const targetCenter = targetIndex * segAngle + segAngle / 2

  useEffect(() => {
    const raf = requestAnimationFrame(() => setRotation(360 * 5 + (360 - targetCenter)))
    // 兜底：transitionend 偶发丢失（后台标签/渲染器卡顿）时，动画结束后仍能进入结果页
    const fallback = setTimeout(finish, 3400)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative mx-auto h-80 w-80">
      {/* 指针 */}
      <div
        className={`absolute -top-3 left-1/2 z-20 -translate-x-1/2 ${spinning ? 'animate-wiggle' : ''}`}
        style={{
          width: 0,
          height: 0,
          borderLeft: '12px solid transparent',
          borderRight: '12px solid transparent',
          borderTop: '22px solid var(--primary)',
          filter: 'drop-shadow(1.5px 1.5px 0 var(--ink))',
        }}
      />

      {/* 外圈（墨色 + 铆钉 + 硬投影） */}
      <div className="h-full w-full rounded-full border-[2.5px] border-[var(--ink)] bg-[var(--card)] p-[9px] shadow-[4px_4px_0_var(--ink)]">
        <div className="relative h-full w-full">
          {/* 转盘面 */}
          <div
            className="h-full w-full rounded-full border-[2.5px] border-[var(--ink)]"
            style={{
              background: gradient,
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 2.8s cubic-bezier(0.15, 0.85, 0.25, 1)',
            }}
            onTransitionEnd={finish}
          >
            {segments.map((d, i) => {
              const center = i * segAngle + segAngle / 2
              return (
                <div
                  key={d.id}
                  className="absolute left-1/2 top-1/2 h-0 w-0"
                  style={{ transform: `rotate(${center}deg)` }}
                >
                  <span
                    className="block w-24 truncate text-center text-xs font-bold text-[var(--ink)]"
                    style={{ transform: 'translate(-50%, -104px)' }}
                  >
                    {d.name.slice(0, 6)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* 铆钉 */}
          {Array.from({ length: 12 }, (_, i) => i * 30).map((a) => (
            <div
              key={a}
              className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full border border-[var(--ink)] bg-[var(--sun)]"
              style={{ transform: `rotate(${a}deg) translateY(-148px)` }}
            />
          ))}
        </div>
      </div>

      {/* 中心圆 */}
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[2.5px] border-[var(--ink)] bg-[var(--card)] text-3xl shadow-[2px_2px_0_var(--ink)]">
        {spinning ? '🍚' : '🎉'}
      </div>

      {spinning && (
        <p className="mt-7 text-center font-display text-sm text-stone-500">
          正在决定命运，转了就认哦…
        </p>
      )}
    </div>
  )
}
