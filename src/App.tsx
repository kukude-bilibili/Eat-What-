import { ErrorBoundary } from './components/ErrorBoundary'
import DishForm from './pages/DishForm'
import Group from './pages/Group'
import Home from './pages/Home'
import Library from './pages/Library'
import Result from './pages/Result'
import Setup from './pages/Setup'
import WheelPage from './pages/WheelPage'
import { useAppStore, type View } from './store/useAppStore'

const PAGES: Record<View, React.ComponentType> = {
  home: Home,
  setup: Setup,
  group: Group,
  wheel: WheelPage,
  result: Result,
  library: Library,
  dishForm: DishForm,
}

/** 角落漂浮的食物贴纸，只在内容后面当装饰 */
const FLOATERS = [
  { emoji: '🍜', className: 'left-1 top-28 text-3xl opacity-30', r: '-12deg', delay: '0s' },
  { emoji: '🥟', className: 'right-2 top-16 text-3xl opacity-30', r: '10deg', delay: '.6s' },
  { emoji: '🧋', className: 'bottom-44 right-1 text-3xl opacity-25', r: '8deg', delay: '1.2s' },
  { emoji: '🍗', className: 'bottom-28 left-1 text-3xl opacity-25', r: '-8deg', delay: '.9s' },
]

export default function App() {
  const view = useAppStore((s) => s.view)
  const Page = PAGES[view]

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-md overflow-hidden px-4 pb-14 pt-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            className={`absolute animate-float ${f.className}`}
            style={{ '--r': f.r, animationDelay: f.delay } as React.CSSProperties}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <div key={view} className="relative animate-fade-up">
        <ErrorBoundary>
          <Page />
        </ErrorBoundary>
      </div>
    </div>
  )
}
