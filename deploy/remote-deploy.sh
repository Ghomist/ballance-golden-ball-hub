#!/usr/bin/env bash
# 服务器侧部署脚本：同步完代码后调用，负责装依赖、重启服务、健康检查、失败自动回滚。
# 用法：bash ~/gbh/deploy/remote-deploy.sh
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"   # uv 装在这里（非交互 SSH 不加载 .bashrc）

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # ~/gbh
HEALTH_URL="http://127.0.0.1:8001/api/health"
cd "$APP_DIR"

echo "[deploy] 目录: $APP_DIR"

echo "[deploy] 同步 Python 依赖（uv sync --frozen --no-dev）"
uv sync --frozen --no-dev

echo "[deploy] 重启服务"
sudo -n systemctl restart gbh

echo "[deploy] 健康检查 $HEALTH_URL"
for i in $(seq 1 15); do
    if curl -fsS -m 3 "$HEALTH_URL" >/dev/null 2>&1; then
        echo "[deploy] 成功：服务已就绪（第 ${i} 次探测）"
        exit 0
    fi
    sleep 1
done

echo "[deploy] 健康检查失败，回滚到上一版代码" >&2
if [ -d "$APP_DIR/app.rollback" ]; then
    rm -rf "$APP_DIR/app"
    cp -a "$APP_DIR/app.rollback" "$APP_DIR/app"
    sudo -n systemctl restart gbh || true
    echo "[deploy] 已回滚并重启" >&2
else
    echo "[deploy] 没有 app.rollback，无法回滚" >&2
fi
journalctl -u gbh -n 30 --no-pager >&2 || true
exit 1
