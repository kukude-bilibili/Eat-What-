import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PrefEditor } from '../components/PrefEditor'
import { commonScope } from '../lib/match'
import { MAX_PEOPLE, useAppStore } from '../store/useAppStore'
import { SPICY_LABELS, blankPerson, type PersonPref } from '../types'

const AVATARS = ['🧑‍🎓', '👩‍🎓', '👨‍🎓', '🧑‍💼', '👩‍💼', '🧑‍🎤', '👨‍🎤', '👩‍🦰']
const AVATAR_BG = ['#ffe3c2', '#d9ecf9', '#fbdcdc', '#e2f0d9', '#fff1b8', '#f3e3f9']

function summarize(p: PersonPref): string {
  const parts: string[] = []
  parts.push(p.budget != null ? `≤${p.budget}元` : '预算不限')
  parts.push(SPICY_LABELS[p.spicy])
  if (p.avoid.length > 0) parts.push(p.avoid.join('、'))
  if (p.likes.length > 0) parts.push(`想吃：${p.likes.join('/')}`)
  return parts.join(' · ')
}

export default function Group() {
  const { groupPeople, setGroupPeople, startSpin, setView, meal, avoidRecent, history } =
    useAppStore()
  const [editing, setEditing] = useState<PersonPref | null>(null)

  const beginAdd = () => setEditing(blankPerson(`${groupPeople.length + 1}号`))

  /** 保存当前人并自动流转到下一位（手机传一圈），满员自动回汇总 */
  const savePerson = () => {
    if (!editing) return
    const people = [
      ...groupPeople,
      { ...editing, name: editing.name.trim() || `${groupPeople.length + 1}号` },
    ]
    setGroupPeople(people)
    setEditing(people.length < MAX_PEOPLE ? blankPerson(`${people.length + 1}号`) : null)
  }

  // 填写中
  if (editing) {
    return (
      <div>
        <PageHeader
          title={`第 ${groupPeople.length + 1} 位，该你了`}
          sub="手机传给他/她，填完点下面传回去"
          onBack={() => setEditing(null)}
        />

        <div className="sticker animate-fade-up px-4 py-5">
          <label className="mb-5 block">
            <span className="mb-2 block font-display text-base">🙋 名字或外号</span>
            <input
              value={editing.name}
              maxLength={12}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="不填就自动叫 1号"
              className="input-sticker w-full px-4 py-3 text-sm"
            />
          </label>

          <PrefEditor value={editing} onChange={setEditing} />
        </div>

        <button
          type="button"
          onClick={savePerson}
          className="btn-pop font-display mt-6 w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white"
        >
          ✅ 填好了，传给下一位
        </button>
        {groupPeople.length >= 1 && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="chip mx-auto mt-4 block px-4 py-2 text-sm font-bold"
          >
            ✋ 就这些人，去汇总
          </button>
        )}
      </div>
    )
  }

  // 汇总页
  const scope = commonScope(groupPeople)
  const canSpin = groupPeople.length >= 2

  return (
    <div>
      <PageHeader
        title="宿舍一起摇"
        sub={groupPeople.length > 0 ? `已就座 ${groupPeople.length} 人` : '手机传一圈，凑齐大家再摇'}
        onBack={() => setView('home')}
      />

      {groupPeople.length === 0 ? (
        <div className="rounded-2xl border-[2.5px] border-dashed border-[var(--ink)] px-4 py-9 text-center opacity-70">
          <div className="text-4xl">👥</div>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            每人填预算、辣度和忌口
            <br />
            大家都能接受的菜，摇出来就别吵了
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupPeople.map((p, i) => (
            <div key={i} className="sticker-flat flex items-center gap-3 px-3.5 py-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--ink)] text-xl"
                style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}
              >
                {AVATARS[i % AVATARS.length]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base leading-tight">{p.name}</div>
                <div className="mt-0.5 truncate text-xs text-stone-400">{summarize(p)}</div>
              </div>
              <button
                type="button"
                onClick={() => setGroupPeople(groupPeople.filter((_, j) => j !== i))}
                className="chip h-7 w-7 shrink-0 text-xs"
                aria-label={`移除 ${p.name}`}
              >
                ✕
              </button>
            </div>
          ))}

          {/* 共同范围：小票 */}
          <div className="sticker relative px-4 py-4">
            <p className="font-display text-base">🧾 大家的共同范围</p>
            <div className="mt-2 border-t-2 border-dashed border-[rgba(63,42,26,0.25)] pt-2.5">
              <p className="text-sm leading-relaxed">
                <span className="font-bold">预算</span> {scope.budgetLabel}
                <span className="mx-1.5 text-stone-300">|</span>
                <span className="font-bold">辣度</span> {scope.spicyLabel}
              </p>
              <p className="mt-1 text-sm">
                <span className="font-bold">时段</span> {meal === '不限' ? '不限' : meal}
                {avoidRecent && history.length > 0 &&
                  ` · 已避开最近摇过的 ${Math.min(history.length, 8)} 道`}
              </p>
              {scope.avoidAll.length > 0 && (
                <p className="mt-1 text-sm">
                  <span className="font-bold">忌口</span> {scope.avoidAll.join('、')}
                </p>
              )}
              {scope.likes && (
                <p className="mt-1 text-sm">
                  <span className="font-bold">想吃</span> {scope.likes.join(' / ')}
                </p>
              )}
              {scope.likesConflict && (
                <p className="mt-1 text-xs text-[var(--primary-deep)]">
                  你们口味没对齐，摇的时候会自动放宽类型
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {groupPeople.length < MAX_PEOPLE && (
          <button
            type="button"
            onClick={beginAdd}
            className="font-display w-full rounded-2xl border-[2.5px] border-dashed border-[var(--ink)] py-3.5 text-lg text-[var(--primary-deep)] transition-all active:scale-95"
          >
            ＋ {groupPeople.length === 0 ? '第一位开始填' : '再加一位'}
          </button>
        )}
        <button
          type="button"
          onClick={() => startSpin()}
          disabled={!canSpin}
          className="btn-pop font-display w-full rounded-2xl bg-[var(--primary)] py-4 text-xl text-white"
        >
          🎯 一起去摇（{groupPeople.length} 人）
        </button>
        {!canSpin && (
          <p className="text-center font-display text-xs text-stone-400">
            至少两位一起摇，才有"共同范围"的意义
          </p>
        )}
      </div>
    </div>
  )
}
