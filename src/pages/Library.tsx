import { useMemo, useState } from 'react'
import { BUILTIN_DISHES } from '../data/dishes'
import { PageHeader } from '../components/PageHeader'
import { useAppStore } from '../store/useAppStore'
import { DISH_TYPES, SPICY_LABELS, type Dish } from '../types'

export default function Library() {
  const { customDishes, openDishForm, setView, removeCustom } = useAppStore()
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('全部')

  const all = useMemo(() => [...customDishes, ...BUILTIN_DISHES], [customDishes])

  const list = useMemo(
    () =>
      all.filter(
        (d) =>
          (typeFilter === '全部' || d.type === typeFilter) &&
          (q === '' || d.name.includes(q) || d.blurb.includes(q)),
      ),
    [all, q, typeFilter],
  )

  // 自己的菜 = 编辑；内置菜由 store 抄一份成自定义草稿
  const tapDish = (d: Dish) => openDishForm(d)

  return (
    <div>
      <PageHeader
        title="菜库"
        sub={`${all.length} 道 · 点内置菜可"抄一份"改成你们的`}
        onBack={() => setView('home')}
      />

      <div className="mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 搜菜名或文案…"
          className="input-sticker min-w-0 flex-1 rounded-full px-4 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={() => openDishForm(null)}
          className="btn-pop font-display shrink-0 rounded-full bg-[var(--sun)] px-4 py-2 text-sm"
        >
          ＋ 添加
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {['全部', ...DISH_TYPES].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`chip shrink-0 px-3 py-1 text-xs font-bold ${typeFilter === t ? 'chip-on' : ''}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {list.map((d) => (
          <div
            key={d.id}
            className="rounded-xl border-2 border-[rgba(63,42,26,0.15)] bg-[var(--card)] px-4 py-3 transition-colors active:border-[var(--ink)]"
          >
            <button type="button" onClick={() => tapDish(d)} className="block w-full text-left">
              <div className="flex items-center gap-2">
                <span className="font-display text-base">{d.name}</span>
                {d.custom && (
                  <span className="rounded-full border-[1.5px] border-[var(--ink)] bg-[var(--leaf)] px-1.5 py-px text-[10px] font-bold text-white">
                    我的
                  </span>
                )}
                <span className="ml-auto shrink-0 font-display text-sm text-[var(--primary-deep)]">
                  ¥{d.price}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
                <span>{d.type}</span>
                <span>{d.scenes.join(' / ')}</span>
                <span className="tracking-tight">{d.spicy === 0 ? '不辣' : '🌶'.repeat(d.spicy)}</span>
              </div>
              <div className="mt-1 text-xs text-stone-500">{d.blurb}</div>
            </button>
            {d.custom && (
              <button
                type="button"
                onClick={() => removeCustom(d.id)}
                className="mt-1.5 text-[10px] text-[var(--primary-deep)] underline underline-offset-2"
              >
                删除
              </button>
            )}
          </div>
        ))}
        {list.length === 0 && (
          <p className="py-12 text-center font-display text-sm text-stone-400">没有找到，换个词试试？</p>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-stone-400">
        辣度对照：{SPICY_LABELS.join(' / ')}
      </p>
    </div>
  )
}
