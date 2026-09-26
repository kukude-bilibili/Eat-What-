import { PageHeader } from '../components/PageHeader'
import { PrefEditor } from '../components/PrefEditor'
import { useAppStore } from '../store/useAppStore'

export default function Setup() {
  const { single, setSingle, startSpin, setView, avoidRecent, setAvoidRecent, history } =
    useAppStore()

  return (
    <div>
      <PageHeader title="你的需求" sub="都可以跳过，选了摇得更准" onBack={() => setView('home')} />

      <PrefEditor value={single} onChange={setSingle} />

      <div className="sticker-flat mt-4 flex items-center justify-between px-4 py-3">
        <div>
          <div className="font-display text-sm">🍽 避开最近吃过的</div>
          <div className="mt-0.5 text-xs text-stone-400">
            按摇饭记录排除（本地有 {history.length} 条）
          </div>
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
        onClick={() => startSpin()}
        className="btn-pop font-display mt-6 w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white"
      >
        🎯 就要这个，开始摇
      </button>
      <p className="mt-4 text-center font-display text-xs text-stone-400">摇中就认，不许反悔（除非手滑）</p>
    </div>
  )
}
