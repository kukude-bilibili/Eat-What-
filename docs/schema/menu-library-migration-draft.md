# 迁移策略：customDishes → personal Menu（schemaVersion 1 → 2）

> 状态：**ACCEPTED + 已实现**（persist migrate 见 src/store/useAppStore.ts；纯函数见 src/lib/migrate.ts；测试见 src/lib/__tests__/menu-v2.test.ts）

## 现状（v1）

- zustand persist，key `what-to-eat-v1`，version: 1
- 用户数据：`customDishes`（散装数组，字段 name/price/spicy/type/tags/meals/scenes/blurb/custom/id('c…')）
- 其余：single/groupPeople/history/scene/mode/meal/mealTouched/avoidRecent/onlyMine/aiKey

## 迁移动作（persist migrate：version 1 → 2）

1. **备份**：迁移前把原始 v1 payload 原文写入 `what-to-eat-v1-backup-v1`（localStorage），这是"无损"的物理保证
2. **建库**：`MenuLibrary { id: 'lib_default', name: '我的菜库', kind: 'personal' }`
3. **建菜单**：`Menu { id: 'menu_personal', libraryId: 'lib_default', title: '我的菜库', shopId: null, kind: 'campus', source: 'manual', migratedFrom: 'customDishes' }`
4. **移菜**：每条 customDish → Dish：
   - `id: 'dish_' + 原id`，`legacyId: 原id`（审计/回滚可查）
   - `menuId: 'menu_personal'`，其余字段原样
   - 全部过 toDish 校验（脏数据丢弃但**先记录**，进 `migration.warnings` 供展示）
5. **清源**：v2 状态里不再有 `customDishes` 字段
6. `schemaVersion: 2` 写入

## 无损保证

- 字段映射表：customDishes 的所有字段在 v2 Dish 中一一有归属，无删除项
- 迁移前的原始备份键不随版本清理，除非用户主动清数据
- 校验失败的脏数据不销毁——存入 `migration.warnings`，界面上展示"X 条旧数据有问题，点开看原文"

## 失败与降级

- migrate 函数抛错 → zustand persist 回退到默认状态（内置库仍可用），**备份键仍在**，界面提示"数据迁移失败，可导出备份"
- schemaVersion 高于当前实现（用户降级了 App）→ 不迁移、不覆盖，内置库可用，提示数据被新版本占用

## 菜单包兼容

- V1 包（菜品数组）：可导入，归入默认库的 personal Menu
- V2 包（带 Menu/Shop 结构）：按结构入库
- 双向：v2 状态可导出 V1 包（拍平），老版本用户也能收

## 测试要求（feature 分支实现时必须带）

1. v1 fixture → migrate → 断言：菜单/菜/字段映射完整、legacyId 在、备份键存在
2. 脏数据 fixture → 迁移不抛错、warnings 有记录
3. 二次启动（已是 v2）→ migrate 幂等不重复建
4. 菜单包 V1/V2 导入导出 round-trip
