"""后端冒烟测试：跑一遍「建图 → 提交流程 → 审核 → 榜单」的端到端流程。

    uv run python scripts/smoke.py
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "smoke.db"
DB_PATH.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.as_posix()}"
os.environ["JWT_SECRET"] = "smoke-secret"
os.environ["ADMIN_USERNAMES"] = '["ghomist"]'

sys.path.insert(0, str(Path(__file__).parent.parent))

import jwt  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


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
    return jwt.encode(payload, "smoke-secret", algorithm="HS256")


def check(label: str, cond: bool, extra: str = "") -> None:
    print(f"{'PASS' if cond else 'FAIL'}  {label} {extra}")
    if not cond:
        raise SystemExit(1)


with TestClient(app) as client:
    # 接口全在 /api 前缀下，这里统一补上，省得每处都写
    for _name in ("get", "post", "put", "patch", "delete"):
        _orig = getattr(client, _name)
        setattr(client, _name, lambda url, *a, _f=_orig, **kw: _f("/api" + url, *a, **kw))

    check("health", client.get("/health").json()["status"] == "healthy")

    admin = {"Authorization": f"Bearer {token('1', 'ghomist', True)}"}
    player = {"Authorization": f"Bearer {token('2', 'player1')}"}

    # 未登录不能提交
    check("匿名提交被拒", client.post("/records", json={"map_id": 1, "video_url": "https://b23.tv/x"}).status_code == 401)
    # 非管理员不能建图
    check("非管理员建图被拒", client.post("/maps", json={"name": "X", "difficulty_level": 1}, headers=player).status_code == 403)

    r = client.post(
        "/maps",
        json={"name": "冒烟测试图", "author": "tester", "difficulty_level": 21},
        headers=admin,
    )
    check("建图", r.status_code == 200, str(r.text)[:200])
    map_id = r.json()["id"]
    check("T20+ 归一化", r.json()["difficulty_label"] == "T20+", r.json()["difficulty_label"])

    r = client.post(
        "/maps/bulk",
        json={"text": "批量图A,作者A,3\n批量图B,作者B,5\n坏数据,x,abc"},
        headers=admin,
    )
    check("批量导入", r.json()["created"] == 2 and len(r.json()["skipped"]) == 1, str(r.json()))

    check("地图库列表", client.get("/maps").json()["total"] == 3)
    check("按难度筛选", client.get("/maps", params={"tier": "T3"}).json()["total"] == 1)
    check("难度档列表", len(client.get("/maps/difficulties").json()["tiers"]) == 3)

    check("坏链接被拒", client.post("/records", json={"map_id": map_id, "video_url": "b23.tv/x"}, headers=player).status_code == 400)
    check("坏日期被拒", client.post("/records", json={"map_id": map_id, "video_url": "https://b23.tv/x", "cleared_on": "2024/01/01"}, headers=player).status_code == 400)
    r = client.post(
        "/records",
        json={"map_id": map_id, "video_url": "https://www.bilibili.com/video/BV1xx", "note": "第一次", "cleared_on": "2024-05-01"},
        headers=player,
    )
    check("提交炼金成果", r.status_code == 200, str(r.text)[:200])
    rec = r.json()
    check("平台识别", rec["video_platform"] == "bilibili", rec["video_platform"])
    check("初始为待审核", rec["status"] == "pending")

    check("匿名看不到待审记录", client.get("/records").json()["total"] == 0)
    check("非管理员按状态筛选被拒", client.get("/records", params={"status": "pending"}, headers=player).status_code == 403)
    check("待审列表", client.get("/admin/pending", headers=admin).json()["total"] == 1)
    check("概览", client.get("/admin/overview", headers=admin).json()["pending"] == 1)

    # 每人每图一条：重复提交覆盖
    r = client.post(
        "/records",
        json={"map_id": map_id, "video_url": "https://youtu.be/abc", "cleared_on": "2024-06-01"},
        headers=player,
    )
    check("重复提交覆盖", r.json()["id"] == rec["id"] and r.json()["video_platform"] == "youtube")
    check("默认不是 FC", r.json()["is_fc"] is False)
    check("覆盖后仍只有一条", client.get("/records/mine", headers=player).json()["total"] == 1)

    check("审核通过", client.post(f"/records/{rec['id']}/review", json={"action": "approve"}, headers=admin).json()["status"] == "approved")
    check("公开可见", client.get("/records").json()["total"] == 1)

    r = client.post(f"/records/{rec['id']}/review", json={"action": "approve", "is_fc": True}, headers=admin)
    check("管理员可以标 FC", r.json()["is_fc"] is True)
    check("仅看 FC 筛选", client.get("/records", params={"fc_only": True}).json()["total"] == 1)
    check("我的 FC 筛选", client.get("/records/mine", params={"fc_only": True}, headers=player).json()["total"] == 1)
    r = client.post(f"/records/{rec['id']}/review", json={"action": "approve", "is_fc": False}, headers=admin)
    check("管理员可以取消 FC", r.json()["is_fc"] is False)
    check("取消后 FC 筛选为空", client.get("/records", params={"fc_only": True}).json()["total"] == 0)

    board = client.get("/leaderboard").json()["tiers"]
    check("榜单分档", board[0]["label"] == "T20+" and board[0]["maps"][0]["clear_count"] == 1, str(board)[:200])

    r = client.get("/users").json()
    check("玩家榜", r["total"] == 1 and r["items"][0]["clear_count"] == 1)
    r = client.get("/users/2").json()
    check("个人主页", r["records"][0]["map_name"] == "冒烟测试图" and r["top_difficulty_label"] == "T20+")

    check("站点统计", client.get("/stats").json()["records_approved"] == 1)

    # 驳回路径
    r = client.post("/records", json={"map_id": map_id, "video_url": "https://b23.tv/yet", "cleared_on": ""}, headers=player)
    check("重新提交回到待审", r.json()["status"] == "pending")
    check("驳回", client.post(f"/records/{rec['id']}/review", json={"action": "reject", "reason": "视频不可见"}, headers=admin).json()["status"] == "rejected")
    check("驳回后公开不可见", client.get("/records").json()["total"] == 0)

    check("封禁玩家", client.post("/admin/users/2/ban", json={"banned": True}, headers=admin).json()["banned"] is True)
    check("封禁后不能提交", client.post("/records", json={"map_id": map_id, "video_url": "https://b23.tv/z"}, headers=player).status_code == 403)
    check("封禁后记录不公开", client.get("/records").json()["total"] == 0)
    check("封禁后不在玩家榜", client.get("/users").json()["total"] == 0)
    check("封禁后不在榜单", client.get("/leaderboard").json()["tiers"] == [])
    check("封禁玩家主页 404", client.get("/users/2").status_code == 404)
    # 管理员提交一次（等同登录落库），否则封禁接口找不到该用户
    other_map = client.get("/maps", params={"tier": "T3"}).json()["items"][0]["id"]
    check("管理员也能提交", client.post("/records", json={"map_id": other_map, "video_url": "https://b23.tv/admin"}, headers=admin).status_code == 200)
    check("不能封禁管理员", client.post("/admin/users/1/ban", json={"banned": True}, headers=admin).status_code == 400)
    check("管理员用户列表", client.get("/admin/users", headers=admin).json()["total"] == 2)

    # 「暂无定义」难度档：等级留空 -> 不算 T20+，单独一档
    r = client.post("/maps", json={"name": "未定档测试图", "author": "anon"}, headers=admin)
    undefined = r.json()
    check(
        "等级留空=暂无定义",
        undefined["difficulty_label"] == "暂无定义"
        and undefined["difficulty_level"] is None
        and undefined["overflow"] is False,
    )
    undefined_id = undefined["id"]
    check("按暂无定义筛选", client.get("/maps", params={"tier": "暂无定义"}).json()["total"] == 1)
    check("降序时暂无定义排最前", client.get("/maps").json()["items"][0]["id"] == undefined_id)
    check(
        "升序时暂无定义排最后",
        client.get("/maps", params={"sort": "difficulty_asc"}).json()["items"][-1]["id"] == undefined_id,
    )
    tiers = client.get("/maps/difficulties").json()["tiers"]
    check("难度档含暂无定义", tiers[0]["label"] == "暂无定义" and tiers[0]["min_level"] is None)
    client.post("/records", json={"map_id": undefined_id, "video_url": "https://b23.tv/undef"}, headers=admin)
    rec_id = client.get("/records/mine", headers=admin).json()["items"][0]["id"]
    client.post(f"/records/{rec_id}/review", json={"action": "approve"}, headers=admin)
    board = client.get("/leaderboard", params={"include_empty": True}).json()["tiers"]
    check(
        "榜单含暂无定义档",
        board[0]["label"] == "暂无定义"
        and board[0]["min_level"] is None
        and board[0]["maps"][0]["difficulty_level"] is None,
    )
    check("删掉未定档测试图", client.delete(f"/maps/{undefined_id}", headers=admin).json()["ok"] is True)

    check("删图连带删记录", client.delete(f"/maps/{map_id}", headers=admin).json()["ok"] is True)
    check("删图后记录清空", client.get("/records").json()["total"] == 0)

print("\n全部通过 ✅")

# Windows 下引擎未释放时删不掉文件，忽略即可
try:
    from app.database import engine

    engine.dispose()
    DB_PATH.unlink(missing_ok=True)
except OSError:
    pass
