export type Scene = '食堂' | '外卖' | '下馆子'
export const SCENES: Scene[] = ['食堂', '外卖', '下馆子']

export const SCENE_EMOJI: Record<Scene, string> = {
  食堂: '🍱',
  外卖: '🛵',
  下馆子: '🍲',
}

/** 用餐时段：作为集体性偏好放在需求层，全量打标保证合理性 */
export type MealTag = '早餐' | '午餐' | '晚餐' | '夜宵'
export type MealPref = '不限' | MealTag
export const MEAL_PREFS: MealPref[] = ['不限', '早餐', '午餐', '晚餐', '夜宵']
export const MEAL_EMOJI: Record<MealPref, string> = {
  不限: '⏰',
  早餐: '🌅',
  午餐: '☀️',
  晚餐: '🌆',
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
  /** v2：归属菜单（用户菜必填；内置库是发版常量，不建模） */
  menuId?: string
  /** v2：迁移前 ID（customDishes 的 'c…'），审计/回滚用 */
  legacyId?: string
  updatedAt?: number
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

/* ── 菜单库 v2（schemaVersion 2，见 docs/schema/menu-library-schema-v2-draft.md）── */

/** 校外店铺品类（研究蒸馏定稿，13 项） */
export const SHOP_CATEGORIES = [
  '快餐',
  '面馆',
  '麻辣烫冒菜',
  '烧烤',
  '汉堡炸鸡',
  '川湘菜',
  '奶茶饮品',
  '日料',
  '韩餐',
  '轻食沙拉',
  '火锅',
  '甜品烘焙',
  '其他',
] as const
export type ShopCategory = (typeof SHOP_CATEGORIES)[number]

export interface MenuLibrary {
  /** 'lib_' 前缀；内置个人库固定 'lib_default' */
  id: string
  name: string
  kind: 'personal' | 'campus' | 'offcampus'
  createdAt: number
  updatedAt: number
}

export interface Shop {
  /** 'shop_' 前缀 */
  id: string
  libraryId: string
  name: string
  category: ShopCategory
  location?: {
    lat: number
    lng: number
    address?: string
    /** 距用户定位的米数，展示用 */
    distanceM?: number
  }
  /** 自由文本，如 "10:00-22:00" */
  hours?: string
  /** 人均（元），来自高德 biz_ext.cost（有则展示/筛选） */
  cost?: number
  /** 高德评分（有则展示） */
  rating?: string
  /** 联系电话（有则展示） */
  tel?: string
  source: 'poi' | 'user'
  /** poi 时存高德 pid，可回查刷新 */
  sourceRef?: string
  updatedAt: number
}

export interface Menu {
  /** 'menu_' 前缀；迁移默认菜单固定 'menu_personal' */
  id: string
  libraryId: string
  /** 校园=自由文本（"二食堂·3F·麻辣香锅窗口"）；校外=冗余店铺名（展示免联查） */
  title: string
  /** kind='shop' 必填；kind='personal'/'campus' 必须为 null（不变式 1） */
  shopId: string | null
  /** personal=用户默认混合菜单；campus=校园窗口；shop=校外店铺 */
  kind: 'personal' | 'campus' | 'shop'
  source: 'manual' | 'ai-scan' | 'pack' | 'poi'
  migratedFrom?: 'customDishes'
  updatedAt: number
}

/** 菜单包 V2（分享载体）；V1 包仍可导入（归入默认库） */
export interface MenuPackV2 {
  pack: 'EATWHAT-PACK-V2'
  /** 分享者署名（可选） */
  from?: string
  libraryName?: string
  /** 校园包可为空 */
  shops?: Shop[]
  menus: Menu[]
  dishes: Dish[]
  schemaVersion: 2
}

/** 转盘的库范围：全部(内置+我的) / 我的所有菜单 / 指定菜单 */
export type SpinScope = 'all' | 'mine' | string
