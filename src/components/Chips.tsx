interface ChipProps {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}

export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip px-3.5 py-1.5 text-sm font-bold ${selected ? 'chip-on' : ''}`}
    >
      {children}
    </button>
  )
}

interface ChipGroupProps {
  label: string
  hint?: string
  options: { value: string | number; label: string }[]
  /** 当前选中的 value 列表（多选）或空（无选中） */
  selected: (string | number)[]
  onToggle: (value: string | number) => void
}

export function ChipGroup({ label, hint, options, selected, onToggle }: ChipGroupProps) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-display text-base">{label}</span>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} selected={selected.includes(o.value)} onClick={() => onToggle(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}
