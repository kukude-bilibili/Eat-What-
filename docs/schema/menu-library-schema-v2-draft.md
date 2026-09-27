# Schema：菜单库 v2（schemaVersion = 2）

> 状态：**ACCEPTED**（2026-09-26 定稿，feature/menu-library-model 按此实现）。定稿决议：
> 1. `SHOP_CATEGORIES` 枚举定稿 13 项（快餐/面馆/麻辣烫冒菜/烧烤/汉堡炸鸡/川湘菜/奶茶饮品/日料/韩餐/轻食沙拉/火锅/甜品烘焙/其他）
> 2. 校园层级 = **自由文本标题**（Menu.title 不结构化拆分）
> 3. `Menu.kind` 三值：`personal | campus | shop`（评审定稿：迁移默认菜单是 personal，语义不冒充校园）；不变式：kind='shop' ⇔ shopId 非空，personal/campus ⇔ shopId 为 null
> 4. `Menu.libraryId` 必填（多库地基，本轮默认 lib_default）
> 5. 孤儿数据不丢弃：孤儿菜→"未分类（恢复）"菜单 + warning；悬空 shopId 的菜单→降级 campus + warning；孤儿 Shop 保留
> 6. 高版本数据保护：存储层检测更高 schemaVersion 拒写不覆盖，原数据原地保留 + UI 提示

## 总览

```
MenuLibrary（库：一个"吃饭的世界"——我的菜库 / XX大学 / 学校周边）
  └─ Menu（菜单：校园=食堂·楼层·窗口；校外=一家店）
       └─ Dish（菜：转盘匹配只读这一层）
  └─ Shop（校外店铺锚点；校园菜单 shopId 为空）
```

## 类型定义（TS 草案）

```ts
type ID = string
// 语义前缀强制：lib_ / shop_ / menu_ / dish_；迁移数据保留 legacyId

interface MenuLibrary {
  id: ID                    // 'lib_default'（内置个人库）
  name: string              // "我的菜库" / "XX大学" / "学校周边"
  kind: 'personal' | 'campus' | 'offcampus'
  createdAt: number
  updatedAt: number
}

interface Shop {
  id: ID                    // 'shop_'
  libraryId: ID
  name: string
  category: string          // 店铺品类。枚举 SHOP_CATEGORIES 待分支产出后定稿
  location?: {
    lat: number
    lng: number
    address?: string
    distanceM?: number      // 距用户定位的米数，展示用
  }
  hours?: string            // 自由文本（"10:00-22:00"）；是否结构化由分支调研结论定
  source: 'poi' | 'user'    // 高德 POI 骨架 / 用户手建
  sourceRef?: string        // poi 时存高德 pid，可回查刷新
  updatedAt: number
}

interface Menu {
  id: ID                    // 'menu_'
  libraryId: ID
  title: string             // 校园："二食堂·3F·麻辣香锅窗口"；校外：冗余店铺名（展示免联查）
  shopId: ID | null         // kind='shop' 必填；kind='campus' 必须为 null（弱化店铺维度）
  kind: 'campus' | 'shop'
  source: 'manual' | 'ai-scan' | 'pack' | 'poi'
  migratedFrom?: 'customDishes'   // 迁移标记（见迁移策略）
  updatedAt: number
}

interface Dish {
  id: ID                    // 'dish_'
  menuId: ID                // 菜属于哪份菜单（必填，替代散装的 customDishes）
  name: string
  price?: number
  spicy?: 0 | 1 | 2 | 3
  type: DishType
  tags: string[]
  meals?: MealTag[]
  scenes: Scene[]
  blurb?: string
  legacyId?: string         // 迁移前 ID（customDishes 的 'c…'），审计/回滚用
  updatedAt: number
}

interface MenuPack {        // 菜单包（分享载体）从 V1 升级；V1 包仍可导入（导入时归入默认库）
  pack: 'EATWHAT-PACK-V2'
  from?: string             // 分享者署名（可选）
  libraryName?: string
  shops?: Shop[]            // 校园包可为空
  menus: Menu[]
  dishes: Dish[]
  schemaVersion: 2
}
```

## 不变式（实现时由校验函数保证，违者拒绝写入）

1. `Menu.kind === 'shop'` ⇔ `Menu.shopId != null`；`kind === 'campus'` ⇔ `shopId === null`
2. `Dish.menuId` 必须指向存在的 Menu；`Menu.libraryId` 必须指向存在的 MenuLibrary
3. 转盘匹配器只读 Dish 的匹配字段（name/price/spicy/type/tags/meals/scenes）——**匹配器不感知 Menu/Shop**（零改动保证）
4. 所有外部进入的数据（迁移/导入/包）必须过 sanitize 接缝（沿用现有 toDish 等纯函数）
5. `schemaVersion` 存于持久化状态根；读取时版本高于当前实现 → 拒绝加载用户数据（只用内置库），原始数据保留不覆盖

## ~~待分支产出后定稿的开放字段~~（已全部定稿，见顶部决议 1-2、5-6）

~~1. Shop.category 枚举~~ ✅ 13 项，见 types.ts SHOP_CATEGORIES
~~2. 校园层级深度~~ ✅ 自由文本标题
~~3. 菜单包 V2 签名/来源链~~ ✅ 本期不做，pack 字段预留 from（署名）
~~4. 内置菜是否建模~~ ✅ 不进 MenuLibrary（发版常量）
