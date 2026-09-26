import { AVOID_OPTIONS, DISH_TYPES, type DishType, type PersonPref } from '../types'
import { ChipGroup } from './Chips'

const BUDGETS = [10, 15, 20, 25, 30, 40]
const SPICY_PREFS = [
  { value: 0, label: '不吃辣' },
  { value: 1, label: '微辣就好' },
  { value: 2, label: '能吃辣' },
  { value: 3, label: '辣王，随便来' },
]

interface Props {
  value: PersonPref
  onChange: (p: PersonPref) => void
}

/** 单人/多人共用的需求填写表单：预算、辣度、忌口、想吃类型，全部可跳过 */
export function PrefEditor({ value, onChange }: Props) {
  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  return (
    <div className="sticker animate-fade-up px-4 py-5">
      <ChipGroup
        label="💰 预算上限"
        hint="不选 = 不限"
        options={[
          ...BUDGETS.map((b) => ({ value: b, label: `${b}元` })),
          { value: 'none', label: '不限' },
        ]}
        selected={value.budget != null ? [value.budget] : ['none']}
        onToggle={(v) => onChange({ ...value, budget: v === 'none' ? null : Number(v) })}
      />

      <ChipGroup
        label="🌶 辣度"
        options={SPICY_PREFS}
        selected={[value.spicy]}
        onToggle={(v) => onChange({ ...value, spicy: Number(v) })}
      />

      <ChipGroup
        label="🚫 忌口"
        hint="选了就绝不出现"
        options={AVOID_OPTIONS.map((a) => ({ value: a, label: a }))}
        selected={[...value.avoid]}
        onToggle={(v) =>
          onChange({ ...value, avoid: toggle(value.avoid, v as PersonPref['avoid'][number]) })
        }
      />

      <ChipGroup
        label="😋 想吃类型"
        hint="不选 = 都行"
        options={DISH_TYPES.map((t) => ({ value: t, label: t }))}
        selected={[...value.likes]}
        onToggle={(v) => onChange({ ...value, likes: toggle(value.likes, v as DishType) })}
      />
    </div>
  )
}
