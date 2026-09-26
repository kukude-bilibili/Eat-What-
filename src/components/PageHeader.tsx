interface Props {
  title: string
  sub?: string
  onBack: () => void
}

/** 统一的子页头：圆形贴纸返回钮 + 快乐体标题 */
export function PageHeader({ title, sub, onBack }: Props) {
  return (
    <header className="mb-6 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="btn-pop h-10 w-10 shrink-0 rounded-full bg-[var(--card)] text-lg"
        aria-label="返回"
      >
        ←
      </button>
      <div className="min-w-0">
        <h1 className="font-display text-xl leading-tight">{title}</h1>
        {sub && <p className="truncate text-xs text-stone-400">{sub}</p>}
      </div>
    </header>
  )
}
