import { useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { AI_KEY_URL, fileToDataUrl, scanMenuPhoto, type DishDraft } from '../lib/ai'
import { useAppStore } from '../store/useAppStore'
import { SCENES, SCENE_EMOJI, type Scene } from '../types'

export default function ScanDish() {
  const { aiKey, setAiKey, saveDraftDishes, setView } = useAppStore()
  const [scene, setScene] = useState<Scene>('食堂')
  const [preview, setPreview] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DishDraft[]>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setDrafts([])
    try {
      setPreview(await fileToDataUrl(file))
    } catch {
      setError('这张图读不出来，换一张试试')
    }
  }

  const scan = async () => {
    if (!preview) return
    setBusy(true)
    setError('')
    const { drafts: result, error: err } = await scanMenuPhoto(aiKey, preview)
    setDrafts(result)
    setPicked(new Set(result.map((_, i) => i)))
    setError(err ?? '')
    setBusy(false)
  }

  const toggle = (i: number) => {
    const next = new Set(picked)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setPicked(next)
  }

  const save = () => {
    const chosen = drafts.filter((_, i) => picked.has(i))
    setSaved(saveDraftDishes(chosen, scene))
  }

  return (
    <div>
      <PageHeader title="🤖 AI 拍菜" sub="拍张菜单照片，自动打标进菜库" onBack={() => setView('library')} />

      {/* 场景归属 */}
      <div className="mb-4 flex gap-2">
        {SCENES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScene(s)}
            className={`chip px-3 py-1.5 text-sm font-bold ${scene === s ? 'chip-on' : ''}`}
          >
            {SCENE_EMOJI[s]} {s}
          </button>
        ))}
      </div>

      {/* 拍照/选图 */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="btn-pop font-display w-full rounded-2xl bg-[var(--sun)] py-4 text-lg"
      >
        📷 {preview ? '重拍一张' : '拍菜单 / 选照片'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      {preview && (
        <img
          src={preview}
          alt="菜单预览"
          className="mt-4 max-h-56 w-full rounded-2xl border-2 border-[var(--ink)] object-cover"
        />
      )}

      {/* API Key（BYOK） */}
      <div className="sticker-flat mt-4 px-4 py-3">
        <label className="block">
          <span className="font-display text-sm">🔑 智谱 API Key（只存你手机里）</span>
          <input
            type="password"
            value={aiKey}
            maxLength={80}
            onChange={(e) => setAiKey(e.target.value)}
            placeholder="粘贴 open.bigmodel.cn 的 Key"
            className="input-sticker mt-2 w-full px-3 py-2.5 text-sm"
          />
        </label>
        <p className="mt-1.5 text-xs text-stone-400">
          没有就到{' '}
          <a href={AI_KEY_URL} target="_blank" rel="noreferrer" className="underline">
            open.bigmodel.cn
          </a>{' '}
          注册领一个，glm-4v-flash 免费模型就够用
        </p>
      </div>

      <button
        type="button"
        onClick={scan}
        disabled={!preview || busy}
        className="btn-pop font-display mt-4 w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white"
      >
        {busy ? '🤖 识别中…' : '🤖 开始识别'}
      </button>

      {error && <p className="mt-3 text-center text-xs font-bold text-[var(--primary-deep)]">{error}</p>}

      {/* 识别结果 */}
      {drafts.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 flex items-center justify-between">
            <span className="font-display text-base">识别到 {drafts.length} 道</span>
            <button
              type="button"
              onClick={() =>
                setPicked(picked.size === drafts.length ? new Set() : new Set(drafts.map((_, i) => i)))
              }
              className="text-xs text-stone-400 underline underline-offset-4"
            >
              {picked.size === drafts.length ? '全不选' : '全选'}
            </button>
          </p>
          <div className="space-y-2">
            {drafts.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left transition-all ${
                  picked.has(i)
                    ? 'border-[var(--ink)] bg-[var(--card)] shadow-[2px_2px_0_var(--ink)]'
                    : 'border-stone-200 bg-white opacity-50'
                }`}
              >
                <span className="text-lg">{picked.has(i) ? '✅' : '⬜'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base">{d.name}</span>
                  <span className="block text-xs text-stone-400">
                    {d.type} · ¥{d.price} · {d.spicy === 0 ? '不辣' : '🌶'.repeat(d.spicy)}
                    {d.meals?.length ? ` · ${d.meals.join('/')}` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={picked.size === 0}
            className="btn-pop font-display mt-4 w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white"
          >
            💾 存入{scene}菜库（{picked.size} 道）
          </button>
          {saved > 0 && (
            <p className="mt-3 text-center font-display text-sm text-[var(--leaf)]">
              ✅ 已入库 {saved} 道（同名自动去重）
            </p>
          )}
        </div>
      )}
    </div>
  )
}
