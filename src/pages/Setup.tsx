import { PageHeader } from '../components/PageHeader'
import { PrefEditor } from '../components/PrefEditor'
import { useAppStore } from '../store/useAppStore'

export default function Setup() {
  const { single, setSingle, startSpin, setView } = useAppStore()

  return (
    <div>
      <PageHeader title="你的需求" sub="都可以跳过，选了摇得更准" onBack={() => setView('home')} />

      <PrefEditor value={single} onChange={setSingle} />

      <button
        type="button"
        onClick={startSpin}
        className="btn-pop font-display mt-6 w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white"
      >
        🎯 就要这个，开始摇
      </button>
      <p className="mt-4 text-center font-display text-xs text-stone-400">摇中就认，不许反悔（除非手滑）</p>
    </div>
  )
}
