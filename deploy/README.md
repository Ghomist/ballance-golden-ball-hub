# 部署说明（挂在 dl.ballance.top/gb 子路径下）

服务器：`ghomist@b.okbc.st:29687`，目录 `/home/ghomist/gbh`
链路：Cloudflare → nginx（`/etc/nginx/conf.d/brh.conf` 里追加的 `location /gb/`）→ `127.0.0.1:8001`（systemd 服务 `gbh`）

和资源站（`dl.ballance.top` → `127.0.0.1:8000`）**共用同一个域名与 nginx server 块**，靠路径前缀区分：
资源站占 `/`，本站占 `/gb/`。两者是完全独立的进程、venv、SQLite 与 systemd 服务，互不影响。

## 子路径带来的三个约定

| 位置 | 值 | 原因 |
|---|---|---|
| `web/vite.config.ts` | `base: "/gb/"`（仅 production） | 否则 index.html 引用的是 `/assets/…`，会打到资源站上 404 |
| `web/src/api.ts` | `BASE` 由 `import.meta.env.BASE_URL` 推导 → `/gb/api` | 否则 `/api/…` 也会打到资源站的后端 |
| `web/src/App.tsx` | `<BrowserRouter basename={BASE_URL 去掉尾斜杠}>` | **否则点导航会跳到同域资源站**：`<Link to="/maps">` 生成 `/maps/x` 而不是 `/gb/maps/x` |
| `gbh.service` | uvicorn `--root-path /gb` | nginx 已剥掉前缀，但 OAuth 回调地址要靠它生成成 `/gb/api/auth/callback` |

本地开发不受影响：dev 下 `base` 仍是 `/`，`pnpm dev` 照旧跑在 `http://localhost:5173`。
路由那一条同样只靠 `BASE_URL`，dev 下会自动退回 `/`，不需要改代码。

> 完整的运维笔记（服务器登录方式与凭据、拓扑、踩过的坑、验收命令、无头浏览器验证技巧）在
> 工作区根目录的 `ballance-projects/README.md` 的「线上部署与运维」一节——它在任何仓库之外，**不会提交也不会上传**。

## nginx（关键片段，追加到 443 的 server 块里）

```nginx
# Golden Ball Hub：/gb 子路径，独立进程 8001（proxy_pass 末尾的 / 会把前缀剥掉）
location = /gb { return 301 /gb/; }
location /gb/ {
    proxy_pass http://127.0.0.1:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

改完必须 `sudo nginx -t && sudo systemctl reload nginx`。

## 目录约定（必须保持）

`app/main.py` 用 `Path(__file__).parent.parent` 定位 `data/` 与 `web/dist`，`.env` 和
`sqlite:///./data/hub.db` 是相对 cwd 的，所以 `WorkingDirectory` 必须是 `/home/ghomist/gbh`。

| 路径 | 用途 |
|---|---|
| `/home/ghomist/gbh/app/` | 后端代码 |
| `/home/ghomist/gbh/scripts/` | 种子导入脚本（`scripts/seed/ranking.json`） |
| `/home/ghomist/gbh/web/dist/` | 前端产物（构建时带 `/gb/` base） |
| `/home/ghomist/gbh/data/hub.db` | SQLite（**永不覆盖**） |
| `/home/ghomist/gbh/.env` | 运行时配置（**永不覆盖**，含 JWT_SECRET） |
| `/home/ghomist/gbh/.venv/` | `uv sync` 生成的虚拟环境 |

## 一次性初始化

```bash
export PATH="$HOME/.local/bin:$PATH"

# 1. 装 systemd 服务（需 sudo）
sudo cp ~/gbh/deploy/gbh.service /etc/systemd/system/gbh.service
sudo cp ~/gbh/deploy/sudoers.d-gbh /etc/sudoers.d/gbh && sudo chmod 440 /etc/sudoers.d/gbh
sudo visudo -c
sudo systemctl daemon-reload
sudo systemctl enable --now gbh

# 2. 装依赖
cd ~/gbh && uv sync --frozen --no-dev

# 3. 灌种子数据（200 张地图 + 99 条历史收录，幂等）
uv run python scripts/seed_import.py --dry-run
uv run python scripts/seed_import.py

# 4. 验收（先看本地 8001，再看公网）
curl -fsS http://127.0.0.1:8001/api/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://dl.ballance.top/gb/
```

## 日常运维

```bash
systemctl status gbh            # 服务状态（sudo 只对 gbh.service 免密）
journalctl -u gbh -n 100 -f     # 日志
sudo systemctl restart gbh      # 重启
curl -s localhost:8001/api/health
```

改前端后重新部署：本地 `cd web && pnpm build` → rsync `web/dist` → **不用重启**（后端每次请求都读盘）。
改后端：rsync `app/` → `bash ~/gbh/deploy/remote-deploy.sh`。

## 依赖 Flarum 后台的两件事（登录用）

1. 在 Flarum 的 OAuth Center 建一个 client，redirect URI 填 **`https://dl.ballance.top/gb/api/auth/callback`**，
   把 client id / secret 写进 `~/gbh/.env` 的 `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET`，再重启服务。
2. 管理员判定默认按 `ADMIN_USERNAMES` 白名单（当前 `["ghomist"]`）；要按 Flarum 管理员组判定，
   再填 `FLARUM_DB_URL`（只读连接串）。

没配 OAuth client 之前，站点可正常浏览（地图库 / 榜单 / 记录都公开），只有登录、提交、审核台不可用。
