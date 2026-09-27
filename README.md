# Ballance 炼金成果站（ballance-golden-ball-hub）

收录 Ballance 玩家的**炼金（Golden Ball）通关成果**：玩家选一张地图、贴上自己的通关视频链接，管理员审核通过后即公开展示；同时维护**地图库与难度分级**（T0 最低 → T20+，可继续向上突破）。

## 功能总览

**核心**
- 登录：复用论坛（Flarum）账号，走 `forum.ballance.top` 的 oauth-center 授权码流程，登录态是后端签发的 JWT。
- 提交炼金成果：选地图 + 视频链接（B 站 / YouTube / 抖音 / 快手 / 贴吧 / 腾讯视频…自动识别平台），可附通关日期、备注，并勾选「这次是 FC 金」；同一张图重复提交会覆盖旧记录并重新进入待审。
- 审核：管理员在审核台通过 / 驳回（可填驳回理由），只有通过的记录才对外展示。
- 地图库：每张地图一个难度等级（T0…T20，≥20 统一显示为 `T20+`），支持按难度档筛选、搜索、排序。
- 榜单：按难度分档展示「哪些地图被谁炼金过」，含通关人数与通关者头像列表。
- 首页（`/`）：两种模式可切换 —— **按提交时间**（全站记录合成一条时间轴，最新的排最上面，不标金银铜，支持「加载更多」）与 **按难度分组**（难度从高到低，`T20+` → `T0`，「暂无定义」档排最前；每档内是一条小时间轴，只取该档最新的 3 条记录，行内显示属于哪张地图，同样不标金银铜）。
- 难度档：T0（最低）→ T20+（突破上限的图仍归入 `T20+`，`top_tier` 可配）；此外保留**「暂无定义」档**——还没人一命通关过、因而无法评档的地图归入此档，与 T 档阶梯分开展示。表格里已有的**历史收录**记录带「表格导入」标记，并直接链到该次通关的 B 站视频（表格「完成者」单元格上的超链接）；玩家日后登录提交即可升级为自己的记录。
- 规则页（`/rules`）：社区《平衡球地图炼金难度排行》的榜单规则与常见问题。

**社区化补充**
- 玩家榜（按通关数 / 最高难度 / 最近提交排序，列表里带该玩家的 **FC 金数量**）、个人主页（个人全部炼金记录 + 最高难度）。
- FC 金：社区里那种「规定了动作、不能吃分」的特殊金。表格《详细记录》里给玩家格**填了底色**的记录即 FC，已全部导入（58 条，见 `scripts/xlsx_to_seed.py` 的 `sheet_fills()`）；提交时可勾选，管理员审核时可标 / 取消（「标为 FC」「取消 FC」）。地图详情页可一键「仅看 FC（N）」。
- 地图「特殊规则」：有些图只允许第某节死几次球（或对路线有要求），这类规则写在表格的单元格批注里，已导入并在地图详情页 / 提交弹窗用琥珀色卡片展示（也可由管理员在地图表单的「描述」里维护）。
- 记录**时间轴**（地图详情页 / 个人主页 / 我的记录 / 审核台待审列表共用同一套）：左侧是一条竖直时间轴——日期在轴左侧，圆点与右侧记录一一对应；没填日期的按提交时间排。最早的 3 条圆点分别填金 / 银 / 铜（按时间算，换排序不会跑位；**个人主页与审核台不填色**，因为那里的「前三」不代表首金）。地图详情页默认「旧→新」、可在「旧→新 / 新→旧」之间切换（同一张图最早的记录就是金、其次是银，所以默认让最早的在上），个人主页 / 我的记录 / 审核台默认也是「旧→新」但仍可切换排序。
- 排行榜/个人页/我的记录的列表：记录行里直接展示「暂无定义」难度徽标，FC 金的玩家名字会标成金色（全站统一用 `amber-400`，与时间轴金点同色）。
- 排序：玩家主页、我的记录、审核台可切换「通关时间新→旧 / 旧→新 / 难度高→低 / 低→高」（纯前端排序，「暂无定义」两个方向都排在最后）；**主维度由用户选，另一维度固定做次级排序、用默认方向（难度高→低、时间新→旧）**。玩家主页的默认是「难度：高→低」+ 次级「时间：新→旧」（时间轴默认旧→新，但该页因为默认按难度所以轴上日期不递增）。地图详情页只给时间两个方向（「旧→新」默认 / 「新→旧」，该页不提供难度排序），保留固定时间轴 +「全部 / 仅看 FC」切换。
- 站点统计（地图数、已通过成果数、玩家数）。
- 管理员：建图 / 改图 / 删图（连带清理记录）、**批量导入地图**（`地图名,作者,难度` 每行一条）、封禁 / 解封玩家。
- 封禁语义：被封禁玩家的记录从所有**公开**接口（榜单、地图通关数、玩家榜、公开记录列表、站点统计）一并隐藏，管理端仍可见。
- 未登录可自由浏览；提交与个人页需要登录；管理操作需要管理员身份。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + shadcn/ui（组件直接落在 `web/src/components/ui`）+ zustand + react-router |
| 后端 | FastAPI + SQLAlchemy 2 + SQLite（`DATABASE_URL` 可换 Postgres/MySQL 等） |
| 鉴权 | Flarum oauth-center（OAuth2 授权码）→ JWT |
| 包管理 | 后端 `uv`，前端 `pnpm` |

## 目录结构

```
ballance-golden-ball-hub/
├── app/                    # FastAPI 后端
│   ├── main.py             # 应用入口：/api 路由 + SPA 静态托管（非 /api 路径回退 index.html）
│   ├── models.py           # User / Map / ClearRecord，难度分级逻辑
│   ├── schemas.py          # 请求/响应模型
│   ├── serializers.py      # ORM → 响应字典；封禁过滤工具
│   ├── auth.py             # JWT 签发校验、管理员判定、链接与日期校验
│   └── api/routes/         # auth / maps / records / users / leaderboard / stats / admin
├── scripts/
│   ├── smoke.py            # 端到端冒烟（TestClient，不启服务）
│   ├── e2e_http.py         # 真实 HTTP 端到端（自动拉起 uvicorn，含 SPA 回退检查）
│   ├── xlsx_to_seed.py     # 排行榜 xlsx → scripts/seed/ranking.json（表格更新时才需手动跑）
│   │                       #   顺便解 zip 读单元格超链接，把视频链接一起带出来
│   ├── seed_import.py      # 把 ranking.json 预填进数据库（幂等，支持 --dry-run）
│   └── seed/ranking.json   # 预填数据（地图 + 历史收录）
├── web/                    # React 前端
│   └── src/
│       ├── api.ts          # 全部 /api 调用封装
│       ├── data/rules.ts   # 榜单规则 + FAQ 文案
│       ├── stores/auth.ts  # 登录态（zustand，token 存 localStorage）
│       ├── components/     # 业务组件 + ui/（shadcn 组件）；OptionTabs = 多选一的按钮组（排序/筛选统一用它）
│       └── views/          # 首页/地图库/地图详情/榜单/玩家/个人页/规则/提交/审核台
├── data/                   # SQLite 数据文件（已 gitignore）
└── .env.example            # 环境变量样例
```

## 本地开发

后端（默认 8000）：

```bash
cp .env.example .env         # 填 OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET / JWT_SECRET
uv run uvicorn app.main:app --reload
```

前端（默认 5173，`/api` 已代理到 8000）：

```bash
cd web
pnpm install
pnpm dev
```

打开 http://localhost:5173 。首次使用建议用管理员账号在「审核台 → 地图管理」里建图，或直接批量导入：

```
# 每行：地图名,作者,难度（# 开头为注释；难度留空或写 - = 暂无定义）
新图示例,作者名,18
另一张图,someone,21
```

### 预填数据（地图库 + 历史收录）

仓库里已经带了一份从《平衡球地图炼金难度排行.xlsx》导出的数据：**200 张地图**（含 12 张「暂无定义」）与 **99 条历史收录通关记录**（覆盖 32 位玩家，每条都带该次通关的 B 站视频链接），其中 **58 条标记为 FC 金**（单元格有底色），另外：

- **22 张地图带「特殊规则」**：表格里地图名格上的批注（例：「仅允许第八节死一次球」「1~13 连体图均可」），导入到 `maps.description`，在地图详情页与提交弹窗里用琥珀色卡片突出显示（例：要素超载 = “fc金允许第五节死一次球吃分”）。
- **3 条记录带批注**：表格里玩家格上的批注（例：「初始为石球」），导入到 `clear_records.note`，随记录一起展示。

规则/批注的解析：批注不在 calamine 的读取范围里，`xlsx_to_seed.py` 直接解 xml（`sheet_comments()` 读 `xl/comments*.xml`，`sheet_values()` 按 Excel 坐标取单元格文本）——注意 calamine 的行号遇空行会与 Excel 行号错位，所以定位批注时两边都用同一套 Excel 坐标。排行榜 sheet 与详细记录 sheet 都有批注时，以详细记录为准。

```bash
uv run python scripts/seed_import.py --dry-run   # 先看会写什么
uv run python scripts/seed_import.py             # 写入 DATABASE_URL 指向的库
```

表格以后更新时，重新生成 JSON 再导入（需要读 xlsx 的解析库，仅这条命令用到）：

```bash
uv run --with python-calamine python scripts/xlsx_to_seed.py
uv run python scripts/seed_import.py
```

导入是幂等的：同名地图按名字更新作者/难度（并补上特殊规则），同一（玩家, 地图）记录已存在则跳过，但会把后来补上的视频链接、FC 标记、批注回填到旧记录上，不会重复插入。

## 生产部署

线上：**`https://dl.ballance.top/gb/`**（子路径，nginx `location /gb/` → `127.0.0.1:8001`，systemd 服务 `gbh`，代码 `/home/ghomist/gbh`；部署细节见 `deploy/README.md`）。

推 `master` 即自动部署（`.github/workflows/deploy.yml`，与资源站同一套：改前端则 Actions 里构建后 rsync `web/dist`，改后端则同步代码 + `uv sync` + 重启并做健康检查、失败自动回滚）。需要仓库 Secrets：`SERVER_HOST` / `SERVER_PORT` / `SERVER_USER` / `SERVER_SSH_KEY`。

手动部署（本地起服务看效果）：

```bash
cd web && pnpm build          # 产物 web/dist
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

后端会在非 `/api` 路径上托管 `web/dist`（命中文件返回文件，否则回退 `index.html`，前端深链接如 `/maps/12` 不会 404）。若 `web/dist` 不存在，访问 `/` 会返回 404 并提示先构建前端。

`.env` 关键项：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 默认 `sqlite:///./data/hub.db`；本机开发时若环境变量已设为 `sqlite:///./data/index.db`，实际写入的就是 `data/index.db` |
| `JWT_SECRET` | 生产必须换成随机串 |
| `TOKEN_EXPIRE` | 登录态有效期（秒），默认 7 天 |
| `FORUM_URL` | Flarum 站点，同时是 OAuth provider base |
| `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` | 在 Flarum 后台 OAuth Center 创建的应用凭据 |
| `FRONTEND_URL` | OAuth 回调后浏览器跳回的前端地址 |
| `ADMIN_USERNAMES` | 管理员用户名白名单（JSON 数组或逗号分隔） |
| `FLARUM_DB_URL` | 可选：直连 Flarum 库只读判定管理员组（`group_id=1`）；留空则只按白名单 |
| `CORS_ORIGINS` | 前后端分域部署时配置 |

## API 一览（前缀 `/api`）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| GET | `/auth/login` | 跳转 Flarum 授权页 |
| GET | `/auth/callback` | 授权回调，签发 token 后 302 回前端 |
| GET | `/auth/me` | 当前登录用户（含 `is_admin`） |
| GET | `/maps` | 地图列表（`q` `tier` `sort` `skip` `limit`） |
| GET | `/maps/difficulties` | 现有难度档一览 |
| GET | `/maps/{id}` | 地图详情 |
| POST/PUT/DELETE | `/maps`、`/maps/{id}` | 建图 / 改图 / 删图（管理员） |
| POST | `/maps/bulk` | 批量导入（管理员） |
| POST | `/records` | 提交或更新我的炼金成果（`is_fc` 声明 FC 金） |
| GET | `/records` | 炼金记录列表（公开仅已通过；`fc_only=true` 只看 FC） |
| GET | `/records/mine` | 我的记录（含待审/驳回；支持 `fc_only`） |
| GET | `/records/by-tier` | 首页「按难度分组」用：每个难度档最近 N 条记录（`per_tier` 默认 3） |
| DELETE | `/records/{id}` | 删除记录（本人或管理员） |
| POST | `/records/{id}/review` | 审核通过 / 驳回（管理员；可带 `is_fc` 修正 FC 标记） |
| GET | `/users` `/users/{id}` | 玩家榜 / 个人主页（含 `clear_count`、`fc_count`） |
| GET | `/leaderboard` `/leaderboard/edges` | 分档榜单 / 难度边界 |
| GET | `/stats` | 站点统计 |
| GET | `/admin/pending` `/admin/overview` `/admin/users` | 审核台数据（管理员） |
| POST | `/admin/users/{id}/ban` | 封禁 / 解封（管理员） |

交互式文档：`/docs`。

## 测试

```bash
uv run python scripts/smoke.py       # TestClient 端到端：建图→提交→审核→榜单→封禁
uv run python scripts/e2e_http.py    # 真实 HTTP：自动拉起 uvicorn，跑完自动关闭
cd web && pnpm exec tsc --noEmit && pnpm build   # 前端类型检查 + 构建
```

## 后续可扩展

- 视频有效性抽查（定时任务探测链接存活）、僵尸链接举报。
- 通关时间/版次字段（不同 Ballance 版本、竞速用）、地图下载与封面托管。
- 难度评定流程（玩家投票 / 分数制换算 T 等级）。
- 「暂无定义」地图在一命通关后自动提醒管理员重新评档。
- 邮件或论坛通知（审核结果推送）。
