# ADR-0003：校外店铺骨架暂不接入高德 POI 自动拉取

- 状态：已接受（2026-09-29）
- 关联：`research/2026-09-29-amap-integration-audit.md`（trip_planner 对照审计）、`docs/schema/menu-library-schema-v2-draft.md`（Shop.source='poi' 回填细节）、ADR-0002

## 背景

菜单库 v2 已支持校外店铺菜单（Shop 锚点 + createMenu 店铺表单）。原 M3 设想用高德 Web 服务 POI 搜索自动生成店铺骨架（店名/品类/位置/营业时间）。同学项目 trip_planner 的对照审计给出了三条硬约束：

1. **CORS**：高德 Web 服务 REST 不承诺浏览器 CORS 直连，标准做法是服务端代理——本项目是纯前端 + 无后端架构
2. **配额**：个人认证周边搜索仅 **100 次/日**（企业 1000 次）；"每次访问都搜周边"的模式几天烧完，结构性风险
3. **Key 暴露**：Web 服务 Key 放前端 = 公开凭据可被刷量；trip_planner 靠服务端统一代理让 Web 服务 Key 不出后端——同样依赖有后端

## 决策

1. **M3 本期不接入高德 Web 服务 API**。校外店铺骨架的数据来源限定为：手填（createMenu 店铺表单）+ 菜单包 + AI 拍菜——零配额消耗、零 Key 暴露
2. `Shop.source='poi'` **保留枚举位**；Schema 回填细节（GCJ-02 存储、字段映射、infocode 分支、网格缓存）作为远期实现的契约保留在 Schema 文档
3. POI 自动化列入**远期项**，前置条件二选一：上 Serverless 代理（Cloudflare Worker 等）或申请企业认证。启用时按 Schema 回填节实现，并评估 BYOK vs 平台 Key 的归属模式
4. `navigator.geolocation` 返回 **WGS-84** 的事实记录在案：本期无地图渲染、无坐标入库，不产生实际影响；未来需要时前端做 WGS-84→GCJ-02 纯函数转换（算法参考审计，禁止固定偏移量近似）

## 后果

- 正面：零配额成本、零 Key 暴露面、无 CORS 问题；校外店铺数据全部来自用户真实录入（更准）
- 代价：校外店铺骨架需要手填（店名/品类/营业时间）——负担可控（一个店铺一次 30 秒），且菜单内容本来就要靠 AI 拍菜/菜单包
- 中性：定位按钮保留在首页（展示能力就绪），不影响任何现有功能
