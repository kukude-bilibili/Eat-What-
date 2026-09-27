import { useState } from 'react'
import { ChipGroup } from '../components/Chips'
import { PageHeader } from '../components/PageHeader'
import { PERSONAL_MENU_ID, useAppStore } from '../store/useAppStore'
import { DISH_TYPES, SCENES, TAG_OPTIONS, type Dish, type Scene } from '../types'

const SPICY_OPTS = [
  { value: 0, label: '不辣' },
  { value: 1, label: '微辣' },
  { value: 2, label: '中辣' },
  { value: 3, label: '特辣' },
]

export default function DishForm() {
  const { editingDish, userDishes, menus, saveCustom, setView } = useAppStore()
  const isEdit = editingDish != null && userDishes.some((d) => d.id === editingDish.id)

  const [name, setName] = useState(editingDish?.name ?? '')
  const [menuId, setMenuId] = useState<string>(editingDish?.menuId ?? PERSONAL_MENU_ID)
  const [scenes, setScenes] = useState<Scene[]>(editingDish?.scenes ?? [])
  const [price, setPrice] = useState(editingDish?.price ?? 15)
  const [spicy, setSpicy] = useState<number>(editingDish?.spicy ?? 1)
  const [type, setType] = useState<Dish['type']>(editingDish?.type ?? '盖饭')
  const [tags, setTags] = useState<string[]>(editingDish?.tags ?? [])
  const [blurb, setBlurb] = useState(editingDish?.blurb ?? '')
  const [err, setErr] = useState('')

  const save = () => {
    if (!name.trim()) return setErr('菜名总得有吧')
    if (scenes.length === 0) return setErr('至少选一个场景')
    saveCustom({
      id: isEdit && editingDish ? editingDish.id : `c${Date.now()}`,
      name: name.trim(),
      menuId,
      scenes,
      price,
      spicy: spicy as Dish['spicy'],
      type,
      tags,
      blurb: blurb.trim() || '自己加的菜',
      custom: true,
    })
  }

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  return (
    <div>
      <PageHeader
        title={isEdit ? '编辑我的菜' : '添加菜'}
        sub="打上标签，摇的时候才会正确匹配忌口"
        onBack={() => setView('library')}
      />

      <div className="sticker animate-fade-up px-4 py-5">
        <ChipGroup
          label="🗂 归属菜单"
          options={menus.map((m) => ({ value: m.id, label: m.title }))}
          selected={[menuId]}
          onToggle={(v) => setMenuId(String(v))}
        />

        <label className="mb-5 block">
          <span className="mb-2 block font-display text-base">🍚 菜名</span>
          <input
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            placeholder="比如：三食堂二楼麻辣香锅"
            className="input-sticker w-full px-4 py-3 text-sm"
          />
        </label>

        <ChipGroup
          label="📍 场景"
          hint="可多选"
          options={SCENES.map((s) => ({ value: s, label: s }))}
          selected={[...scenes]}
          onToggle={(v) => setScenes(toggle(scenes, v as Scene))}
        />

        <label className="mb-5 block">
          <span className="mb-2 block font-display text-base">💵 人均/单份价格（元）</span>
          <input
            type="number"
            min={1}
            max={999}
            value={price}
            onChange={(e) => setPrice(Math.max(1, Number(e.target.value) || 0))}
            className="input-sticker w-full px-4 py-3 text-sm"
          />
        </label>

        <ChipGroup
          label="🌶 辣度"
          options={SPICY_OPTS}
          selected={[spicy]}
          onToggle={(v) => setSpicy(Number(v))}
        />

        <ChipGroup
          label="🍱 类型"
          options={DISH_TYPES.map((t) => ({ value: t, label: t }))}
          selected={[type]}
          onToggle={(v) => setType(v as Dish['type'])}
        />

        <ChipGroup
          label="🏷 食材标签"
          hint="用于忌口匹配"
          options={TAG_OPTIONS.map((t) => ({ value: t, label: t }))}
          selected={tags}
          onToggle={(v) => setTags(toggle(tags, v as string))}
        />

        <label className="mb-1 block">
          <span className="mb-2 block font-display text-base">✏️ 一句文案（可选）</span>
          <input
            value={blurb}
            maxLength={50}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="比如：阿姨看到你会多给一勺"
            className="input-sticker w-full px-4 py-3 text-sm"
          />
        </label>
      </div>

      {err && <p className="mt-3 text-center text-xs font-bold text-[var(--primary-deep)]">{err}</p>}

      <button
        type="button"
        onClick={save}
        className="btn-pop font-display mt-6 w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white"
      >
        💾 保存
      </button>
    </div>
  )
}
