# 今天吃啥 · 饭点摇一摇

帮学生党（宿舍/同桌多人场景）在饭点 30 秒内定下**具体吃哪道菜**：
大家轮流填需求，系统在"所有人都能接受"的范围内一键摇出 1 道菜，**摇中就认**。

## 本地开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 产物在 dist/
npm run preview  # 本地预览构建产物
```

## 部署（Cloudflare Pages，免费）

1. 把仓库推到 GitHub
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 构建配置：Framework preset 选 **Vite**，Build command `npm run build`，输出目录 `dist`
4. 部署完成后得到 `xxx.pages.dev` 域名，把二维码发给同学即可

> 备选：Vercel / Netlify 同理（都是纯静态站点，零后端）。

## 技术栈

- React 19 + Vite + TypeScript + Tailwind CSS 4
- zustand（localStorage 持久化，无账号、无后端）
- 转盘动画纯 CSS（conic-gradient + transform），无第三方动画库

## 目录结构

```
src/
├── data/dishes.ts        # 内置菜品库（~244 道，含标签）
├── lib/
│   ├── match.ts          # 多人交集匹配 + 逐级放宽 + 兜底
│   └── reason.ts         # 推荐理由 / 文案生成
├── store/useAppStore.ts  # 全局状态（zustand + persist）
├── components/
│   ├── Chips.tsx         # 标签选择器
│   ├── PrefEditor.tsx    # 单人/多人共用的需求表单
│   └── Wheel.tsx         # 转盘组件
└── pages/                # Home / Setup / Group / WheelPage / Result / Library / DishForm
```

## 核心算法（match.ts）

匹配条件：场景匹配 → 价格 ≤ 最低预算 → 辣度 ≤ 最低容忍 → 排除所有人忌口 → 类型取交集（没填的人不限）。

凑不齐时按顺序放宽并明确提示：**想吃类型 → 辣度(+1) → 预算(+5元)**；仍无结果则给"冲突最小"的前 3 道候选。

## 数据约定

- `scenes`: 食堂 / 外卖 / 下馆子
- `spicy`: 0 不辣 / 1 微辣 / 2 中辣 / 3 特辣
- `tags`: 猪肉 / 牛肉 / 羊肉 / 鸡肉 / 鸭肉 / 海鲜 / 鱼 / 内脏 / 蛋 / 素（忌口匹配靠它）
- 自定义菜存 localStorage（key `what-to-eat-v1`），与内置库合并

## 明确不做（第一版）

下单/支付/外卖 API、账号登录、社交、真实餐厅 POI 数据、分享链接多人各自填。

## 安全设计

- **随机**：全部走 `src/lib/random.ts`（`crypto.getRandomValues` CSPRNG + 拒绝采样），转盘公平性有密码学背书
- **本地数据**：localStorage 可被任意改写，回读/写入都过 `useAppStore.ts` 的白名单校验与长度封顶，脏数据直接丢弃不崩溃
- **输入**：菜名/文案/昵称长度封顶 + 控制字符过滤；React 默认转义，无 `dangerouslySetInnerHTML`
- **响应头**：`public/_headers` 提供 CSP（全 self、无 unsafe-inline）、nosniff、frame-ancestors none 等，Cloudflare Pages 部署自动生效
- **依赖**：`npm audit` 0 漏洞

## 二期候选

- 微信群里分享链接、各自填需求、人齐出结果（需要房间机制 + 后端）
- 账号/云同步自定义菜库
- 有限否决权（每人可否决 1~2 次）
- 升级微信小程序
