# ADR-0001：菜单库统一模型（MenuLibrary / Menu / Shop / Dish）

- 状态：已接受（2026-09-26）
- 关联：docs/schema/menu-library-schema-v2-draft.md、docs/schema/menu-library-migration-draft.md

## 背景

现有自定义菜库是散装数组（customDishes），无法表达"食堂/楼层/窗口"（校园）和"店铺"（校外）两种真实组织方式；用户需求明确要求扩展到校外周边商家。

## 决策

1. 引入 MenuLibrary → Menu → Dish 三层 + Shop 锚点（schemaVersion 2）
2. **校园 Menu 弱化店铺维度**：shopId 为 null，组织维度是食堂/楼层/窗口（体现在 Menu.title 或其结构化拆分）
3. **校外 Menu 强绑定店铺**：shopId 必填，Shop 携带品类/位置/营业时间
4. **转盘匹配器不感知 Menu/Shop**：匹配只读 Dish 的字段。这是硬边界——保证现有匹配器/测试零改动，且"摇出什么"永远由菜的属性决定
5. 内置 248 道菜暂不建模进 MenuLibrary（发版常量），模型只管用户数据（分支如有强反例可翻案）

## 后果

- 正面：两类场景统一存储与分享（MenuPack V2）；新增数据维度（窗口/店铺/距离）有落点；匹配器零风险
- 代价：一次 persist 迁移（见迁移策略草案）；菜库/结果页展示逻辑需按 shopId 分叉
- 中性：schemaVersion 机制从此建立，后续模型变更走版本化迁移
