/**
 * 高德 JS API 2.0 集成（浏览器端，可行性结论见 research/2026-09-29-amap-integration-audit.md）：
 * - JS SDK 无 CORS 问题（区别于 Web 服务 REST）
 * - Key 为浏览器公开凭据，防盗用靠域名白名单（kukude-bilibili.github.io + localhost）
 * - 配额按 JS Key 计（个人认证额度未公开精确值）→ 结果必须缓存，7 天 TTL
 * - 坐标系：JS API 全程 GCJ-02，与 POI 一致，无转换需求
 */

const AMAP_KEY = 'key2d6e6fa8f5a02ce5aaa00e1bbc5906ed'
const AMAP_SECURITY = 'b711d9cc1892efe574f382ee00e7437e'
/** 学校名：周边搜索的锚点 */
export const SCHOOL_NAME = '广东石油化工学院'
/** 搜索半径（米） */
export const SEARCH_RADIUS_M = 3000
/** 缓存键与 TTL */
export const RESTAURANT_CACHE_KEY = 'amap-restaurants-cache-v1'
const CACHE_TTL = 7 * 24 * 3600 * 1000

import type { Dish, Shop, ShopCategory } from '../types'
import { secureInt } from './random'

declare global {
  interface Window {
    AMap?: any
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

let amapPromise: Promise<any> | null = null

/** 按需加载高德 JS SDK（含 PlaceSearch 插件），幂等 */
export function loadAMap(): Promise<any> {
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapPromise) return amapPromise
  amapPromise = new Promise((resolve, reject) => {
    window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.PlaceSearch`
    script.onload = () => {
      if (window.AMap) resolve(window.AMap)
      else {
        amapPromise = null
        reject(new Error('高德 SDK 加载异常：脚本已载入但 AMap 未就绪'))
      }
    }
    script.onerror = () => {
      amapPromise = null
      reject(new Error('高德 SDK 加载失败：请检查网络后重试'))
    }
    document.head.appendChild(script)
  })
  return amapPromise
}

/** 高德 POI 品类（type 字段）→ SHOP_CATEGORIES 13 项的关键词映射 */
export function mapPoiCategory(poiType: string): ShopCategory {
  const t = String(poiType ?? '')
  const rules: [RegExp, ShopCategory][] = [
    [/火锅/i, '火锅'],
    [/烧烤|烤肉/i, '烧烤'],
    [/面馆|面食|粉|米线/i, '面馆'],
    [/奶茶|咖啡|茶馆|饮品|冷饮/i, '奶茶饮品'],
    [/蛋糕|面包|甜品|烘焙|糕点/i, '甜品烘焙'],
    [/日.{0,2}料|寿司|刺身/i, '日料'],
    [/韩|石锅|部队/i, '韩餐'],
    [/汉堡|炸鸡|披萨/i, '汉堡炸鸡'],
    [/轻食|沙拉|素食/i, '轻食沙拉'],
    [/川菜|湘菜|川湘/i, '川湘菜'],
    [/快餐|小吃|简餐|盒饭/i, '快餐'],
  ]
  for (const [re, cat] of rules) if (re.test(t)) return cat
  return '其他'
}

function toNum(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** 高德 POI → Shop（GCJ-02 坐标直存；缺字段容错） */
export function poiToShop(poi: any, now = Date.now()): Shop | null {
  if (!poi || !poi.name || !poi.location) return null
  const lat = Number(poi.location.lat)
  const lng = Number(poi.location.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const address = [poi.pname, poi.cityname, poi.adname, poi.address]
    .filter(Boolean)
    .join('')
  const cost = toNum(poi.biz_ext?.cost)
  const rating = typeof poi.biz_ext?.rating === 'string' && poi.biz_ext.rating
    ? poi.biz_ext.rating
    : undefined
  return {
    id: `shop_amap_${poi.id}`,
    libraryId: 'lib_default',
    name: String(poi.name).slice(0, 30),
    category: mapPoiCategory(poi.type),
    location: {
      lat,
      lng,
      ...(address ? { address: address.slice(0, 60) } : {}),
      ...(typeof poi.distance === 'number'
        ? { distanceM: Math.round(poi.distance) }
        : {}),
    },
    ...(poi.biz_ext?.open_time ? { hours: String(poi.biz_ext.open_time).slice(0, 30) } : {}),
    ...(cost ? { cost } : {}),
    ...(rating ? { rating } : {}),
    ...(poi.tel ? { tel: String(poi.tel).slice(0, 30) } : {}),
    source: 'poi',
    ...(poi.id ? { sourceRef: String(poi.id) } : {}),
    updatedAt: now,
  }
}

/** PlaceSearch 回调包 Promise */
function psCall(ps: any, method: 'search' | 'searchNearBy', ...args: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    ps[method](...args, (status: string, result: any) => {
      if (status === 'complete') resolve(result)
      else if (status === 'error') reject(new Error(`高德搜索失败：${result?.info ?? '未知错误'}`))
      else resolve(result) // no_data 也算正常完成（空结果）
    })
  })
}

export interface NearbyResult {
  shops: Shop[]
  /** 学校坐标（GCJ-02），供导航/距离展示 */
  schoolLocation?: { lat: number; lng: number }
  fromCache: boolean
  error?: string
}

function readCache(): NearbyResult | null {
  try {
    const raw = localStorage.getItem(RESTAURANT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; shops: Shop[]; schoolLocation?: { lat: number; lng: number } }
    if (Date.now() - parsed.at > CACHE_TTL) return null
    return {
      shops: parsed.shops ?? [],
      ...(parsed.schoolLocation ? { schoolLocation: parsed.schoolLocation } : {}),
      fromCache: true,
    }
  } catch {
    return null
  }
}

function writeCache(shops: Shop[], schoolLocation?: { lat: number; lng: number }) {
  try {
    localStorage.setItem(
      RESTAURANT_CACHE_KEY,
      JSON.stringify({ at: Date.now(), shops, ...(schoolLocation ? { schoolLocation } : {}) }),
    )
  } catch {
    /* 存储满等异常不阻断 */
  }
}

/** 强制刷新（绕过缓存） */
export async function fetchRestaurantsFresh(): Promise<NearbyResult> {
  const AMap = await loadAMap()
  const ps = new AMap.PlaceSearch({ city: '茂名', pageSize: 25, type: '餐饮服务' })

  // 1. 学校锚点：关键词搜索"广东石油化工学院"
  const schoolResult = await psCall(ps, 'search', SCHOOL_NAME)
  const schoolPoi = schoolResult?.poiList?.pois?.[0]
  if (!schoolPoi?.location) {
    return {
      shops: [],
      fromCache: false,
      error: `没有找到「${SCHOOL_NAME}」的位置，请检查关键词或稍后再试`,
    }
  }
  const schoolLocation = { lat: Number(schoolPoi.location.lat), lng: Number(schoolPoi.location.lng) }

  // 2. 周边餐饮（半径 3km）
  const nearbyResult = await psCall(ps, 'searchNearBy', '', schoolLocation, SEARCH_RADIUS_M)
  const pois: any[] = nearbyResult?.poiList?.pois ?? []
  const shops = pois
    .map((p) => poiToShop(p))
    .filter((s): s is Shop => s !== null)

  if (shops.length === 0) {
    return {
      shops: [],
      ...(schoolLocation ? { schoolLocation } : {}),
      fromCache: false,
      error: '周边 3km 没搜到餐饮店铺，换个更远半径或手动添加',
    }
  }

  writeCache(shops, schoolLocation)
  return { shops, ...(schoolLocation ? { schoolLocation } : {}), fromCache: false }
}

/** 对外入口：优先缓存（7 天内），失败时回退过期缓存 */
export async function fetchRestaurants(): Promise<NearbyResult> {
  const cached = readCache()
  if (cached) return cached
  try {
    return await fetchRestaurantsFresh()
  } catch (e) {
    // 实时失败：回退过期缓存（比报错好）
    try {
      const raw = localStorage.getItem(RESTAURANT_CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { shops?: Shop[]; schoolLocation?: { lat: number; lng: number } }
        if (parsed.shops?.length) {
          return {
            shops: parsed.shops,
            ...(parsed.schoolLocation ? { schoolLocation: parsed.schoolLocation } : {}),
            fromCache: true,
            error: `高德请求失败（${(e as Error).message}），已回退上次缓存数据`,
          }
        }
      }
    } catch {
      /* 忽略 */
    }
    return { shops: [], fromCache: false, error: (e as Error).message }
  }
}

/** 店内摇菜复用：matchDishes 不感知餐馆（ADR-0001 同款边界）；随机走 CSPRNG */
export function pickDishForShop(dishes: Dish[]): Dish | null {
  if (dishes.length === 0) return null
  return dishes[secureInt(dishes.length)] ?? null
}
