# 高德地图 API 接入 · 结合本项目的踩坑对照与防御清单

> 用途：承接《地图 API 接入访谈清单（vibe coding 踩坑预备，2026-09-27）》，结合 trip_planner 项目代码现状逐条核验，输出「已解决 / 部分覆盖 / 仍有缺口」结论，作为 M3（校外店铺骨架：高德 POI BYOK）的技术预研与访谈问题备答。
> 日期：2026-09-29　关联文件：`collab_recsys`（推荐子系统）、`trip_planner/amap_client.py`、`geo_utils.py`、`location.py`、`frontend/src/views/map/MapExploreView.vue`
> 结论回填目标：`docs/schema`（Shop.source='poi' 实现细节）、ADR-0003（坐标 / 配额策略取舍）

---

## 0. 总论

访谈清单假设的画像是一手项目「新手第一次接高德」，但 **trip_planner 已经是一套防御性相当成熟的高德集成**：

- 服务端统一代理所有 REST 调用（Web 服务 Key 不出后端）；
- 双坐标系（WGS-84 / GCJ-02）全程显式区分，含手写转换算法；
- 多级缓存（Redis → 进程内）＋ 熔断兜底；
- Web 服务 Key 与 JS API Key 严格分流。

清单 7 类坑位中 **5 类已在代码层面解决**，真正缺口集中在「无 JS Key / 超限时的降级体验」与「错误码细分」两处（见 §3 缺口清单）。

---

## 1. 官方事实核验（2026-09 当期，附链接）

### 1.1 Key 与安全密钥

| 事实 | 说明 | 链接 |
|---|---|---|
| Key 按平台不通 | Web 服务 Key 与 Web 端 JS API Key 不通用，混用报 `USERKEY_PLAT_NOMATCH`（"The request key does not match the bound platform"） | [错误码说明](https://lbs.amap.com/api/web-service/tools/info) |
| JS API 安全密钥 | 2021-12-02 之后创建的 JS API Key 必须配合 `securityJsCode` 使用 | [JS API 前置要求](https://lbs.amap.com/api/javascript-api-v2/prerequisites) |

### 1.2 配额与计费

| 接口 | 个人认证日配额 | 企业认证日配额 | 备注 |
|---|---|---|---|
| 周边搜索 / 文本搜索 / ID 查询 | **100 次** | 1000 次 | 个人配额极低，是 M3 的核心约束 |
| 逆地理编码 | 5000 次 | 300 万次 | 差距极大 |
| QPS | 官方未公开基础服务 QPS，需到控制台配额管理页查看 | — | [配额说明](https://lbs.amap.com/faq/account/certification/39670)、[QPS 说明](https://lbs.amap.com/api/webservice/guide/tools/flowlevel) |

### 1.3 错误码（超限分支）

| 场景 | infocode | info |
|---|---|---|
| 日配额超限 | `10003` | `DAILY_QUERY_OVER_LIMIT` |
| 分钟级请求过于频繁 | `10004` | `ACCESS_TOO_FREQUENT` |
| QPS / 并发超限 | `10014` / `10019` / `10020` / `10021` | `QPS_HAS_EXCEEDED_THE_LIMIT` 等 |
| 账号维度日配额超限 | `10044` | `USER_DAILY_QUERY_OVER_LIMIT` |

来源：[官方错误码说明](https://lbs.amap.com/api/web-service/tools/info)

### 1.4 CORS 与调用方式

官方 Web 服务 REST 通过 HTTP/HTTPS 访问、返回 JSON/XML，**未承诺浏览器 CORS 直连**——浏览器 fetch 直连存在跨域限制，标准做法是自建后端代理。来源：[周边搜索](https://lbs.amap.com/api/webservice/guide/api/search/)、[逆地理编码](https://lbs.amap.com/api/webservice/guide/api/georegeo)

### 1.5 返回结构与分页

- `location` 字段格式：`"lng,lat"`（经度在前，纬度在后，逗号分隔），需 split 后使用
- `offset` 强烈建议不超过 25（超过可能访问报错）；`page` 为当前页
- 新 POI 搜索 2.0：`page_size` 1–25，`page_num` 1–100
- `status`：1 成功 / 0 失败；`infocode`：`10000` 表示正确；`count`：单次实际返回条数

来源：[基础搜索](https://lbs.amap.com/api/webservice/guide/api/search/)、[高级搜索](https://lbs.amap.com/api/webservice/guide/api-advanced/search)、[状态说明](https://developer.amap.com/api/webservice/guide/tools/info)

### 1.6 坐标系

- WGS-84：GPS 国际标准；GCJ-02：中国国测局加密体系（高德 / 腾讯国内使用）；BD-09：百度二次加密
- `navigator.geolocation` 返回 **WGS-84**；微信 `wx.getLocation` 默认 `type="wgs84"`，可设 `gcj02` 返回 GCJ-02
- 高德 JS API / Web 服务 POI 返回 **GCJ-02**；官方推荐 `AMap.convertFrom(lnglat, type, cbk)`（JS API 内置，一次 ≤40 对）；REST 侧有 `v3/assistant/coordinate/convert`（个人认证日配额 5000 次）
- 坐标系不一致造成的点位移 / 距离误差可达 **50–700 米**量级，且非线性随地区变化，不能按固定偏移处理

来源：[AMap.convertFrom](https://lbs.amap.com/api/javascript-api-v2/guide/transform/convertfrom)、[坐标转换 REST](https://lbs.amap.com/api/webservice/guide/api/convert)、[坐标系 FAQ（腾讯）](https://lbs.qq.com/faq/latlngFaq)、[高德坐标系说明](https://developer.amap.com/faq/advisory/others/39838)

---

## 2. 逐条对照：清单坑位 × 项目现状

### 2.1 Key 与安全 — ✅ 已解决（且优于清单预期）

- **Key 类型分流**：`env_utils.py` L33–37 严格区分 `AMAP_API_KEY`（Web 服务）与 `AMAP_JS_KEY`（JS API），与清单 1.1「Key 类型选错」完全对应且已规避。
- **安全密钥 jscode**：`MapExploreView.vue` L143 已设置 `_AMapSecurityConfig = { securityJsCode }`，正确满足 JS API 2.0 的 2021-12 后硬性要求。
- **Key 泄漏**：Web 服务 Key 只存在于服务端（`amap_client.py` / `location.py`），前端仅通过 `/api/v1/config/map` 拿到 JS Key。后端注释明确：「JS Key 本就设计为浏览器端公开凭据，防盗用靠高德后台的域名白名单」。清单担心的「REST Key 打进 bundle / 提交 git」在本架构下**不可能发生**。
- **BYOK 模式**：M3 若让用户自带 Key，需补前端存储方案与风险提示（见 §4 建议）。

### 2.2 配额与计费 — ⚠️ 部分解决（真实缺口）

- 已做：`amap_client.py` 三层缓存（Redis → 进程内，`HOTSPOT_CACHE_TTL=3600`）、`fetch_hotspots` 仅冷启动拉一次、`city_suggest` 30 分钟 TTL、`reverse_geocode` 按 111m 网格缓存 7 天、`CacheService` 三级降级。配额已被显著压缩。
- 缺口：所有服务端调用只判 `status != "1"` 即 break，**未按 `infocode`（10003 / 10004 / 10044）区分处理**，无超限可读提示，无「超限后走兜底缓存」策略。清单 1.2「超限表现 / 烧配额模式」的代码分支尚未落地。

### 2.3 浏览器与跨域 — ✅ 已解决（架构正确）

- 前端 `api/*.ts` 全部走 `/api/v1/*` 代理，REST 调用统一在服务端 `amap_client.py`——直接避开 CORS 直连坑，并顺带解决 REST Key 暴露。
- 注意：`项目介绍.md` 中「单文件 `index.html` + Tailwind CDN + MarkerCluster」描述已**过时**，实际为 Vite + Vue3 + TS（`MapExploreView.vue`，无 MarkerCluster）。文档与代码脱节本身值得记录。

### 2.4 坐标系 — ✅ 已解决（项目最强项）

- `geo_utils.py` 手写 **WGS-84 ↔ GCJ-02** 转换（含境外判断 `_out_of_china`）；`recommend.recommend` 的 `coord_type` 参数（`main.py` L337）要求前端显式声明坐标系；前端 store 同时维护 `userLatLng`（WGS-84）与 `userGcjLatLng`（GCJ-02）。
- 逆地理编码（`location.py`）在服务端先 `wgs84_to_gcj02` 再调高德，坐标流闭环正确。
- 清单 1.4「坐标系隐蔽坑」在本项目已被系统性规避。

### 2.5 接口细节 — ✅ 基本已处理

- `parse_amap_location`（`geo_utils.py`）正确 split `"lng,lat"`；`offset` 统一 `min(limit, 25)`；多页拉取 `pages` 有上限。
- POI 详情（`fetch_poi_detail`）已用 `biz_ext` 的 `rating` / `cost` / `open_hours`；高德**无文字简介字段**，介绍以图片 + 关键信息呈现（清单访谈问题 5 的答案：字段够做店铺卡片，但简介与配图质量参差）。

### 2.6 合规 — ✅ 已规避主要风险

- 后端 `main.py` 有全局异常脱敏（`_public_error_message`，默认不透出内部细节），CORS 白名单明确列出，无通配符 + 凭据组合。
- 前端定位需遵循「声明采集位置信息」要求（浏览器提示天然覆盖）。

### 2.7 vibe coding 特有 — ✅ 架构免疫

- AI 混用厂商参数 / 过时文档 / 硬编码 Key：本项目所有高德调用收敛在 `amap_client.py` / `location.py` 两个模块，参数格式统一（`location` 恒为 `"lng,lat"`），Key 一律从 `env_utils` 读取，未发现硬编码。
- 唯一残留：`项目介绍.md` 与代码不同步（§2.3）。

---

## 3. 真实缺口清单（建议动手补）

| # | 缺口 | 位置 | 建议 |
|---|---|---|---|
| 1 | **无 JS Key 时降级体验弱** | `MapExploreView.vue` L36–39 | 现为无 Key 直接 `empty-state` 隐藏整个地图。建议改为「列表 + 地图」渐进降级：无 Key 时仍展示 POI 列表（`/api/v1/hotspots` 数据不依赖 JS Key），有 Key 才渲染地图。README 已将此列为已知缺陷 |
| 2 | **超限 / 非 status=1 分支不细分** | `amap_client.py` 各函数 | 对 `infocode=10003/10004/10044` 结构化区分：记录日志指标、返回可读错误、超限时回退到最近成功缓存（已有熔断骨架 `_api_fail_count`，可扩展为按错误码分类） |
| 3 | **个人配额 100 次/天的结构性风险** | M3 设计 | 校外店铺**不应**在每次用户访问时触发周边搜索。应改为：服务端定时任务预拉 + 热点 POI 入库落为 `Shop(source='poi')` 记录，前端只读库 |

---

## 4. M3（校外店铺骨架）落地建议

- **Shop.source='poi' 可落定细节**：坐标沿用 GCJ-02 存储；`location` 字段解析统一走 `geo_utils.parse_amap_location`；详情字段映射 `biz_ext.rating / cost / open_hours`，图片轮播沿用 `fetch_poi_detail` 的 5 图结构。
- **ADR-0003 建议记录的真实取舍**：个人认证 Key 日配额 100 次 → 周边搜索改「服务端缓存热点 POI + 入库落 Shop」，前端零直连配额消耗；若未来切企业认证（1000 次/天）或用户 BYOK，则解耦缓存策略。
- **BYOK 若上线**：前端存储建议 `sessionStorage` 而非 `localStorage`（降低持久暴露面），并明示「Key 仅存本机、泄漏可被刷量」风险提示；服务端提供 Key 有效性预检接口。

---

## 5. 访谈 prompt 与问题适配

- 6 条 prompt 基本可直接复用；**第 2 条（CORS）与第 4 条（配额）**因本项目已走服务端代理 + 多级缓存，可简化，重点问「对方是否真的遇过直连 CORS / 配额烧完」，以对比验证我们的架构选择。
- **第 3 / 5 条（坐标系、Key 安全）**与本项目防御现状最贴合，是访谈核心问题，重点收集对方在 GCJ-02 偏移与 Key 防盗上的实操教训。
- 访谈问题 5（高德 POI 字段够不够做店铺卡片）：结论为**字段足够**（rating/cost/open_hours 均有），短板是无文字简介与配图质量，店铺卡片需自行补齐简介素材或依赖 UGC（项目「内容生态」规划正好对口）。

---

## 6. 参考链接汇总

- [高德 Web 服务错误码](https://lbs.amap.com/api/web-service/tools/info)
- [JS API 2.0 前置要求（Key/安全密钥）](https://lbs.amap.com/api/javascript-api-v2/prerequisites)
- [认证与配额 FAQ（个人/企业）](https://lbs.amap.com/faq/account/certification/39670)
- [Web 服务 QPS 说明](https://lbs.amap.com/api/webservice/guide/tools/flowlevel)
- [基础 POI 搜索](https://lbs.amap.com/api/webservice/guide/api/search/)
- [高级 POI 搜索](https://lbs.amap.com/api/webservice/guide/api-advanced/search)
- [逆地理编码](https://lbs.amap.com/api/webservice/guide/api/georegeo)
- [坐标系转换（JS API convertFrom）](https://lbs.amap.com/api/javascript-api-v2/guide/transform/convertfrom)
- [坐标系转换（REST）](https://lbs.amap.com/api/webservice/guide/api/convert)
- [高德坐标系说明（GCJ-02）](https://developer.amap.com/faq/advisory/others/39838)
- [腾讯坐标系 FAQ](https://lbs.qq.com/faq/latlngFaq)
- [W3C Geolocation（WGS-84）](https://www.w3.org/TR/2021/WD-geolocation-20210715/)
- [微信 wx.getLocation 坐标系参数](https://developers.weixin.qq.com/minigame/dev/api/location/wx.getLocation.html)
