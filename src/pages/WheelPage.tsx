import { useMemo } from 'react'
import { Wheel } from '../components/Wheel'
import { secureShuffle } from '../lib/random'
import { useAppStore } from '../store/useAppStore'

export default function WheelPage() {
  const outcome = useAppStore((s) => s.outcome)
  const finishSpin = useAppStore((s) => s.finishSpin)
  const setView = useAppStore((s) => s.setView)

  const segments = useMemo(() => {
    if (!outcome?.result) return []
    const shuffled = secureShuffle(outcome.pool).slice(0, 8)
    if (!shuffled.some((d) => d.id === outcome.result!.id)) shuffled[0] = outcome.result
    return shuffled
  }, [outcome])

  if (!outcome?.result || segments.length === 0) return null
  const targetIndex = segments.findIndex((d) => d.id === outcome.result!.id)

  return (
    <div className="pt-6">
      {outcome.relaxed.length > 0 && (
        <p className="badge-pop mx-auto mb-6 w-fit px-4 py-1.5 text-xs">
          为了凑齐大家，放宽了{outcome.relaxed.join('、')}
        </p>
      )}
      <Wheel segments={segments} targetIndex={targetIndex} onDone={finishSpin} />
      <button
        type="button"
        onClick={() => setView('home')}
        className="mx-auto mt-9 block font-display text-sm text-stone-400 underline underline-offset-4"
      >
        不摇了，回去
      </button>
    </div>
  )
}
