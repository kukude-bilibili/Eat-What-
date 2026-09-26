import { useMemo, useState } from 'react'
import { BUILTIN_DISHES } from '../data/dishes'
import { exportPack } from '../lib/pack'
import { PageHeader } from '../components/PageHeader'
import { useAppStore } from '../store/useAppStore'
import { DISH_TYPES, SPICY_LABELS, type Dish } from '../types'

export default function Library() {
  const { customDishes, onlyMine, setOnlyMine, importPack, openDishForm, setView, removeCustom } =
    useAppStore()
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('全部')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState('')

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

  const doImport = () => {
    const r = importPack(importText)
    setImportMsg(r.error ? `❌ ${r.error}` : `✅ 已导入 ${r.count} 道（同名自动跳过）`)
    if (!r.error) {
      setImportText('')
      setShowImport(false)
    }
  }

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
          onClick={() => setView('scanDish')}
          className="btn-pop font-display shrink-0 rounded-full bg-[var(--sky)] px-3.5 py-2 text-sm"
        >
          🤖 拍菜
        </button>
        <button
          type="button"
          onClick={() => openDishForm(null)}
          className="btn-pop font-display shrink-0 rounded-full bg-[var(--sun)] px-3.5 py-2 text-sm"
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

      {/* 校园菜单库 */}
      <div className="sticker-flat mb-4 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-base">🏫 校园菜单库</div>
            <div className="mt-0.5 text-xs text-stone-400">
              {customDishes.length} 道自己的菜{onlyMine ? ' · 转盘只出这些' : ''}
            </div>
          </div>
          {customDishes.length >= 6 || onlyMine ? (
            <button
              type="button"
              className={`chip shrink-0 px-3 py-1.5 text-sm font-bold ${onlyMine ? 'chip-on' : ''}`}
              onClick={() => setOnlyMine(!onlyMine)}
            >
              {onlyMine ? '只摇我们的' : '混着摇'}
            </button>
          ) : (
            <span className="shrink-0 text-xs text-stone-400">攒满 6 道解锁</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="chip text-xs"
            disabled={!customDishes.length}
            onClick={() => {
              navigator.clipboard
                .writeText(exportPack(customDishes))
                .then(() => setImportMsg('📤 菜单包已复制，发给同学在下面粘贴导入'))
                .catch(() => setImportMsg('复制失败：剪贴板不可用'))
            }}
          >
            📤 导出菜单包
          </button>
          <button type="button" className="chip text-xs" onClick={() => setShowImport(!showImport)}>
            📥 导入菜单包
          </button>
        </div>
        {showImport && (
          <div className="mt-2">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={4}
              placeholder="粘贴同学发你的菜单包文本…"
              className="input-sticker w-full text-xs"
            />
            <button type="button" className="chip chip-on mt-2 text-xs" onClick={doImport}>
              导入并去重
            </button>
          </div>
        )}
        {importMsg && <p className="mt-2 text-xs text-stone-500">{importMsg}</p>}
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
