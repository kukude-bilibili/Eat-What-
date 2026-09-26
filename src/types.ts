export type Scene = '食堂' | '外卖' | '下馆子'
export const SCENES: Scene[] = ['食堂', '外卖', '下馆子']

export const SCENE_EMOJI: Record<Scene, string> = {
  食堂: '🍱',
  外卖: '🛵',
  下馆子: '🍲',
}

/** 用餐时段：作为集体性偏好放在需求层 */
export type MealTag = '早餐' | '夜宵'
export type MealPref = '不限' | MealTag
export const MEAL_PREFS: MealPref[] = ['不限', '早餐', '夜宵']
export const MEAL_EMOJI: Record<MealPref, string> = {
  不限: '⏰',
  早餐: '🌅',
  夜宵: '🌙',
}

export type DishType =
  | '盖饭'
  | '面食'
  | '粉米线'
  | '麻辣烫冒菜'
  | '火锅烤肉'
  | '汉堡炸鸡'
  | '日料寿司'
  | '韩餐'
  | '烧烤'
  | '轻食'
  | '小吃'
  | '硬菜'

export const DISH_TYPES: DishType[] = [
  '盖饭',
  '面食',
  '粉米线',
  '麻辣烫冒菜',
  '火锅烤肉',
  '汉堡炸鸡',
  '日料寿司',
  '韩餐',
  '烧烤',
  '轻食',
  '小吃',
  '硬菜',
]

export const SPICY_LABELS = ['不辣', '微辣', '中辣', '特辣'] as const

/** 荤素/食材标签：忌口匹配和“吃素”过滤都靠它 */
export const TAG_OPTIONS = ['猪肉', '牛肉', '羊肉', '鸡肉', '鸭肉', '海鲜', '鱼', '内脏', '蛋', '素'] as const

export const AVOID_OPTIONS = ['不吃猪肉', '不吃牛肉', '不吃羊肉', '不吃海鲜', '不吃内脏', '不吃蛋', '吃素'] as const
export type AvoidOption = (typeof AVOID_OPTIONS)[number]

export interface Dish {
  id: string
  name: string
  scenes: Scene[]
  /** 人均/单份估价（元） */
  price: number
  spicy: 0 | 1 | 2 | 3
  type: DishType
  tags: string[]
  /** 一句文案 */
  blurb: string
  /** 适用时段（缺省 = 任何时候都合适） */
  meals?: MealTag[]
  custom?: boolean
}

export interface PersonPref {
  name: string
  /** 预算上限（元），null = 不限 */
  budget: number | null
  /** 0 不吃辣 / 1 微辣 / 2 中辣 / 3 随便 */
  spicy: number
  avoid: AvoidOption[]
  /** 想吃的类型，空 = 不限 */
  likes: DishType[]
}

export function blankPerson(name: string): PersonPref {
  return { name, budget: null, spicy: 3, avoid: [], likes: [] }
}
