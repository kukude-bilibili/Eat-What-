import { useMemo, useState } from 'react'
import { BUILTIN_DISHES } from '../data/dishes'
import { exportPackV1Flat, exportPackV2 } from '../lib/pack'
import { PageHeader } from '../components/PageHeader'
import { PERSONAL_MENU_ID, useAppStore } from '../store/useAppStore'
import { DISH_TYPES, SHOP_CATEGORIES, SPICY_LABELS, type Dish, type Menu } from '../types'

const KIND_LABEL: Record<Menu['kind'], string> = {
  personal: '我的菜库',
  campus: '校园菜单',
  shop: '店铺',
}

export default function Library() {
  const {
    userDishes,
    menus,
    shops,
    spinMenu,
    setSpinMenu,
    createMenu,
    renameMenu,
    removeMenu,
    importPack,
    openDishForm,
    removeCustom,
    setView,
    migration,
    blockedByHigherVersion,
  } = useAppStore()
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('全部')
  const [showCreate, setShowCreate] = useState(false)
  const [createKind, setCreateKind] = useState<'campus' | 'shop'>('campus')
  const [createTitle, setCreateTitle] = useState('')
  const [createCategory, setCreateCategory] = useState<string>('快餐')
  const [createHours, setCreateHours] = useState('')
  const [createdMsg, setCreatedMsg] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState('')

  const list = useMemo(
    () =>
      userDishes.filter(
        (d) =>
          (typeFilter === '全部' || d.type === typeFilter) &&
          (q === '' || d.name.includes(q) || d.blurb.includes(q)),
      ),
    [userDishes, q, typeFilter],
  )

  // 菜单排序：personal 置顶，其余按最近更新
  const orderedMenus = useMemo(() => {
    const sorted = [...menus].sort((a, b) => b.updatedAt - a.updatedAt)
    return sorted.sort((a, b) => (a.id === PERSONAL_MENU_ID ? -1 : 0) - (b.id === PERSONAL_MENU_ID ? -1 : 0))
  }, [menus])

  const doExportV2 = () => {
    navigator.clipboard
      .writeText(exportPackV2(menus, userDishes, shops, '我的校园'))
      .then(() => setImportMsg('📤 菜单包 V2 已复制（含菜单/店铺结构）'))
      .catch(() => setImportMsg('复制失败：剪贴板不可用'))
  }
  const doExportV1 = () => {
    navigator.clipboard
      .writeText(exportPackV1Flat(userDishes))
      .then(() => setImportMsg('📤 V1 兼容包已复制（只含菜品，老版本用户可收）'))
      .catch(() => setImportMsg('复制失败：剪贴板不可用'))
  }
  const doImport = () => {
    const r = importPack(importText)
    setImportMsg(r.error ? `❌ ${r.error}` : `✅ 已导入 ${r.count} 道（同名自动跳过）`)
    if (!r.error) {
      setImportText('')
      setShowImport(false)
    }
  }

  const doCreate = () => {
    const id = createMenu({
      kind: createKind,
      title: createTitle,
      ...(createKind === 'shop' ? { category: createCategory, hours: createHours } : {}),
    })
    if (id) {
      setCreatedMsg(`✅ 已创建「${createTitle.trim()}」`)
      setCreateTitle('')
      setCreateHours('')
      setShowCreate(false)
    } else {
      setCreatedMsg(createKind === 'campus' ? '标题总得有吧' : '店名总得有吧')
    }
  }

  const renderDish = (d: Dish) => (
    <div key={d.id} className="dish-item" onClick={() => openDishForm(d)}>
      <div className="row">
        <span className="dish-name">{d.name}</span>
        <span className="dish-tag-me">我的</span>
        <span className="dish-price">¥{d.price}</span>
      </div>
      <div className="dish-meta">
        <span>{d.type}</span>
        <span>{d.scenes.join(' / ')}</span>
        <span>{d.spicy === 0 ? '不辣' : '🌶'.repeat(d.spicy)}</span>
      </div>
      <div className="dish-blurb">{d.blurb}</div>
      <span
        style={{ fontSize: '20rpx', color: 'var(--primary-deep)', marginTop: '8rpx', display: 'inline-block' }}
        onClick={(e) => {
          e.stopPropagation()
          removeCustom(d.id)
        }}
      >
        删除
      </span>
    </div>
  )

  return (
    <div className="page animate-fade-up">
      <PageHeader
        title="菜库"
        sub="按菜单分组 · 点菜可编辑归属"
        onBack={() => setView('home')}
      />

      {blockedByHigherVersion && (
        <div className="sticker-flat mb3" style={{ borderColor: 'var(--primary)' }}>
          <div className="title-sm" style={{ color: 'var(--primary-deep)' }}>
            ⚠️ 检测到更高版本的数据
          </div>
          <div className="tiny mt2">
            你的本地数据来自更新的版本，已原地保留未被覆盖；本次以默认内置菜库运行。升级应用后数据自动恢复。
          </div>
        </div>
      )}

      {migration.warnings.length > 0 && (
        <div className="sticker-flat mb3">
          <div className="title-sm">📋 数据迁移提示</div>
          {migration.warnings.slice(0, 3).map((w, i) => (
            <div key={i} className="tiny mt2">
              · {w}
            </div>
          ))}
        </div>
      )}

      {/* 转盘范围 */}
      <div className="sticker-flat mb4 px-4 py-3">
        <div className="title-sm mb3">🎯 转盘范围</div>
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${spinMenu === 'all' ? 'chip-on' : ''}`}
            onClick={() => setSpinMenu('all')}
          >
            全部（内置 {BUILTIN_DISHES.length}+）
          </button>
          <button
            type="button"
            className={`chip ${spinMenu === 'mine' ? 'chip-on' : ''}`}
            onClick={() => setSpinMenu('mine')}
          >
            我的全部（{userDishes.length}）
          </button>
          {menus.map((m) => {
            const count = userDishes.filter((d) => d.menuId === m.id).length
            return (
              <button
                key={m.id}
                type="button"
                className={`chip ${spinMenu === m.id ? 'chip-on' : ''}`}
                onClick={() => setSpinMenu(m.id)}
              >
                {m.title}（{count}）
              </button>
            )
          })}
        </div>
      </div>

      {/* 菜单管理 */}
      <div className="sticker-flat mb-4 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="title-sm">🗂 菜单管理</div>
          <button
            type="button"
            className="chip text-xs"
            onClick={() => {
              setShowCreate(!showCreate)
              setCreatedMsg('')
            }}
          >
            ＋ 新建菜单
          </button>
        </div>

        {showCreate && (
          <div className="mt2">
            <div className="chip-row mb2">
              <button
                type="button"
                className={`chip ${createKind === 'campus' ? 'chip-on' : ''}`}
                onClick={() => setCreateKind('campus')}
              >
                🏫 校园窗口
              </button>
              <button
                type="button"
                className={`chip ${createKind === 'shop' ? 'chip-on' : ''}`}
                onClick={() => setCreateKind('shop')}
              >
                🏪 校外店铺
              </button>
            </div>
            <input
              value={createTitle}
              maxLength={30}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder={createKind === 'campus' ? '如：二食堂·3F·麻辣香锅窗口' : '如：华莱士（东门店）'}
              className="input-sticker w-full text-sm"
            />
            {createKind === 'shop' && (
              <div className="mt2">
                <div className="chip-row mb2">
                  {SHOP_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`chip ${createCategory === c ? 'chip-on' : ''}`}
                      onClick={() => setCreateCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  value={createHours}
                  maxLength={30}
                  onChange={(e) => setCreateHours(e.target.value)}
                  placeholder="营业时间（可选），如 10:00-22:00"
                  className="input-sticker w-full text-sm"
                />
              </div>
            )}
            <button type="button" className="chip chip-on mt2 text-xs" onClick={doCreate}>
              创建
            </button>
            {createdMsg && <p className="tiny mt2">{createdMsg}</p>}
          </div>
        )}

        <div className="mt2">
          {orderedMenus.map((m) => {
            const shop = m.shopId ? shops.find((sp) => sp.id === m.shopId) : undefined
            const count = userDishes.filter((d) => d.menuId === m.id).length
            return (
            <div key={m.id} className="row mt2" style={{ justifyContent: 'space-between' }}>
                {renaming === m.id ? (
                  <div className="grow">
                    <input
                      value={renameText}
                      maxLength={30}
                      className="input-sticker w-full text-sm"
                      onChange={(e) => setRenameText(e.target.value)}
                    />
                    <button
                      type="button"
                      className="chip chip-on mt2 text-xs"
                      onClick={() => {
                        renameMenu(m.id, renameText)
                        setRenaming(null)
                      }}
                    >
                      保存
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grow">
                      <span className="text-sm font-bold">
                        {m.title}
                      </span>
                      <span className="tiny ml-2">
                        {KIND_LABEL[m.kind]}
                        {shop ? ` · ${shop.category}${shop.hours ? ` · ${shop.hours}` : ''}` : ''} · {count} 道
                      </span>
                    </div>
                    {m.id !== PERSONAL_MENU_ID && (
                      <span className="shrink-0 text-xs text-stone-400">
                        <span
                          onClick={() => {
                            setRenaming(m.id)
                            setRenameText(m.title)
                          }}
                        >
                          ✎
                        </span>
                        {' '}
                        <span
                          style={{ color: 'var(--primary-deep)' }}
                          onClick={() => removeMenu(m.id)}
                        >
                          🗑
                        </span>
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 搜索与筛选 */}
      <div className="lib-toolbar">
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

      <div className="mb-4 flex flex-wrap gap-2">
        {['全部', ...DISH_TYPES].map((t) => (
          <button
            key={t}
            type="button"
            className={`chip ${typeFilter === t ? 'chip-on' : ''}`}
            onClick={() => setTypeFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 按菜单分组的菜品 */}
      {orderedMenus.map((m) => {
        const shop = m.shopId ? shops.find((sp) => sp.id === m.shopId) : undefined
        const groupDishes = list.filter((d) => d.menuId === m.id)
        if (groupDishes.length === 0) return null
        return (
            <div key={m.id} className="mb-5">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-display text-base">
                {m.kind === 'personal' ? '📁 ' : m.kind === 'campus' ? '🏫 ' : '🏪 '}
                {m.title}
              </span>
              <span className="text-xs text-stone-400">
                {shop ? `${shop.category}${shop.hours ? ` · ${shop.hours}` : ''} · ` : ''}
                {groupDishes.length} 道
              </span>
            </div>
            {shop && (
              <div className="tiny mb-2">
                📍 {shop.name} · {shop.category}
                {shop.hours ? ` · ${shop.hours}` : ''}
              </div>
            )}
            <div className="space-y-2.5">{groupDishes.map(renderDish)}</div>
          </div>
        )
      })}
      {list.length === 0 && (
        <p className="py-10 text-center text-sm text-stone-400">
          {userDishes.length === 0
            ? '还没有自己的菜：点 🤖拍菜 扫菜单，或 ＋添加 手动录入'
            : '没有找到，换个词试试？'}
        </p>
      )}

      {/* 菜单包 */}
      <div className="sticker-flat mt-4 px-4 py-3">
        <div className="title-sm">📦 菜单包</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="chip text-xs" onClick={doExportV2}>
            📤 导出 V2（含菜单/店铺）
          </button>
          <button
            type="button"
            className="chip text-xs"
            disabled={!userDishes.length}
            onClick={doExportV1}
          >
            📤 V1 兼容包
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
              placeholder="粘贴同学发你的菜单包文本（V2 结构包或 V1 菜品包均可）…"
              className="input-sticker w-full text-xs"
            />
            <button type="button" className="chip chip-on mt-2 text-xs" onClick={doImport}>
              导入并去重
            </button>
          </div>
        )}
        {importMsg && <p className="mt-2 text-xs text-stone-500">{importMsg}</p>}
      </div>

      <p className="page-tip mt-4">
        辣度对照：{SPICY_LABELS.join(' / ')} · 内置 {BUILTIN_DISHES.length} 道不在分组里，转盘"全部"时可用
      </p>
    </div>
  )
}
