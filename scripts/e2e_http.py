"""真实 HTTP 端到端检查：自己拉起 uvicorn，跑一遍完整流程后关掉。

    uv run python scripts/e2e_http.py

覆盖：/api 前缀下的全部公开接口 + SPA 静态回退 + 管理员建图/批量导入/审核/封禁。
"""

import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).parent.parent
DB_PATH = ROOT / "data" / "e2e.db"
PORT = 8011
BASE = f"http://127.0.0.1:{PORT}"
SECRET = "e2e-secret"

DB_PATH.unlink(missing_ok=True)

import httpx  # noqa: E402
import jwt  # noqa: E402

FAILED: list[str] = []


def token(user_id: str, username: str, is_admin: bool = False) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "display_name": f"{username} 的昵称",
        "avatar_url": "",
        "profile_url": f"https://forum.ballance.top/u/{username}",
        "is_admin": is_admin,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


def check(label: str, cond: bool, extra: str = "") -> None:
    print(f"{'PASS' if cond else 'FAIL'}  {label} {extra}")
    if not cond:
        FAILED.append(label)


def main() -> int:
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite:///{DB_PATH.as_posix()}",
        "JWT_SECRET": SECRET,
        "ADMIN_USERNAMES": '["ghomist"]',
        "FRONTEND_URL": "http://localhost:5173",
    }
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    admin = {"Authorization": f"Bearer {token('1', 'ghomist', True)}"}
    player = {"Authorization": f"Bearer {token('2', 'player')}"}

    try:
        client = httpx.Client(base_url=BASE, timeout=10.0)
        for _ in range(50):
            try:
                if client.get("/api/health").status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            time.sleep(0.3)
        else:
            print("服务启动失败")
            return 1

        # 静态资源 / SPA 回退
        root = client.get("/")
        check("首页返回 SPA", root.status_code == 200 and '<div id="root">' in root.text)
        deep = client.get("/maps/1")
        check("深链接回退到 SPA", deep.status_code == 200 and '<div id="root">' in deep.text)
        check("未知 API 返回 404", client.get("/api/not-exist").status_code == 404)

        # 空站状态
        check("空地图库", client.get("/api/maps").json()["total"] == 0)
        check("空榜单", client.get("/api/leaderboard").json()["tiers"] == [])
        check("站点统计", client.get("/api/stats").json()["maps"] == 0)

        # 管理员建图 + 批量导入
        created = client.post(
            "/api/maps",
            json={"name": "E2E 地图", "author": "tester", "difficulty_level": 5},
            headers=admin,
        )
        check("新建地图", created.status_code == 200 and created.json()["difficulty_label"] == "T5")
        map_id = created.json()["id"]
        check("匿名不能建图", client.post("/api/maps", json={"name": "x"}).status_code == 401)

        bulk = client.post(
            "/api/maps/bulk",
            json={"text": "# 注释行\n批量图A,alice,15\n批量图B,bob,21\nE2E 地图,tester,6"},
            headers=admin,
        ).json()
        check("批量导入", bulk["created"] == 2 and bulk["updated"] == 1, str(bulk))

        tiers = client.get("/api/maps/difficulties").json()
        labels = [tier["label"] for tier in tiers["tiers"]]
        check("难度档覆盖 T20+", "T20+" in labels and "T15" in labels, str(labels))

        # 玩家提交 → 审核 → 公开可见
        flat_id = client.get("/api/maps", params={"sort": "difficulty_asc"}).json()["items"][0]["id"]
        submitted = client.post(
            "/api/records",
            json={"map_id": flat_id, "video_url": "https://www.bilibili.com/video/BV1xxxx", "cleared_on": "2026-01-01"},
            headers=player,
        )
        check("提交炼金链接", submitted.status_code == 200, submitted.text[:120])
        record_id = submitted.json()["id"]
        check("提交后为待审", submitted.json()["status"] == "pending")
        check("识别视频平台", submitted.json()["video_platform"] == "bilibili", submitted.json()["video_platform"])
        check("非法链接被拒", client.post("/api/records", json={"map_id": flat_id, "video_url": "not-a-url"}, headers=player).status_code == 400)

        check("待审列表", client.get("/api/admin/pending", headers=admin).json()["total"] == 1)
        check("非管理员看不到待审", client.get("/api/admin/pending", headers=player).status_code == 403)

        approved = client.post(
            f"/api/records/{record_id}/review", json={"action": "approve"}, headers=admin
        )
        check("审核通过", approved.status_code == 200 and approved.json()["status"] == "approved")

        board = client.get("/api/leaderboard").json()["tiers"]
        check("榜单出现地图", any(m["name"] for t in board for m in t["maps"]))
        check("匿名可见公开记录", client.get("/api/records", params={"map_id": flat_id}).json()["total"] == 1)
        check("站点统计更新", client.get("/api/stats").json()["records_approved"] == 1)
        check("玩家榜", client.get("/api/users").json()["items"][0]["clear_count"] == 1)
        detail = client.get("/api/users/2").json()
        check("个人主页", detail["clear_count"] == 1 and detail["top_difficulty_label"] == "T6", detail["top_difficulty_label"])
        check(
            "地图详情带炼金人数",
            client.get(f"/api/maps/{flat_id}").json()["clear_count"] == 1,
        )

        # 封禁：记录从公开榜单消失，解封后恢复
        check("封禁玩家", client.post("/api/admin/users/2/ban", json={"banned": True}, headers=admin).status_code == 200)
        check("封禁后不能提交", client.post("/api/records", json={"map_id": flat_id, "video_url": "https://b23.tv/x"}, headers=player).status_code == 403)
        check("封禁后记录从榜单隐藏", client.get("/api/leaderboard").json()["tiers"] == [])
        check("解封", client.post("/api/admin/users/2/ban", json={"banned": False}, headers=admin).json()["banned"] is False)
        check("解封后记录恢复", len(client.get("/api/leaderboard").json()["tiers"]) == 1)

        client.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()

    print()
    if FAILED:
        print(f"失败 {len(FAILED)} 项：{', '.join(FAILED)}")
        return 1
    print("全部通过 ✅")
    try:
        DB_PATH.unlink(missing_ok=True)
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
