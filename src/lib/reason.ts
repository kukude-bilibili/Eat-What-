import type { Dish, PersonPref } from '../types'
import { secureInt } from './random'

const HEADERS = [
  '天意已至，别挣扎了',
  '转盘说了算：就它',
  '这是大家都能接受的答案',
  '命运齿轮转到了这一格',
  '纠结结束，干饭开始',
  '今天的运气全在这道菜里',
]

export function pickHeader(): string {
  return HEADERS[secureInt(HEADERS.length)]
}

/** 根据匹配情况生成一句推荐理由 */
export function makeReason(dish: Dish, people: PersonPref[], relaxed: string[]): string {
  const parts: string[] = []

  if (relaxed.length > 0) {
    parts.push(`为了凑齐大家，放宽了${relaxed.join('和')}`)
  } else if (people.length > 1) {
    parts.push('所有人的预算、辣度、忌口都对上了')
  } else {
    parts.push('预算和口味都替你筛好了')
  }

  const budgets = people.map((p) => p.budget).filter((b): b is number => b != null)
  const minBudget = budgets.length ? Math.min(...budgets) : null
  parts.push(minBudget != null ? `人均约${dish.price}元，在你预算内` : `人均约${dish.price}元`)

  if (dish.spicy === 0 && people.some((p) => p.spicy === 0)) {
    parts.push('一点不辣，怕辣的人也能冲')
  } else if (dish.spicy >= 2) {
    parts.push('够味够劲，配饭绝了')
  }

  return parts.join('；') + '。'
}

const WARM_LINES = [
  '今天也辛苦啦，吃点好的。',
  '别纠结了，吃饱了才有力气想别的。',
  '胃暖了，心情就不会太差。',
  '好好吃饭，就是好好爱自己。',
]

export function pickWarmLine(): string {
  return WARM_LINES[secureInt(WARM_LINES.length)]
}
