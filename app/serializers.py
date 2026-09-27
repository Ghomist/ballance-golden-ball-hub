"""把 ORM 对象转成前端直接可用的响应字典（统一放这里，避免路由间循环 import）。"""

from urllib.parse import urlparse

from app.config import settings
from app.models import ClearRecord, Map, User, difficulty_label

_PLATFORMS = (
    ("bilibili", "bilibili.com"),
    ("youtube", "youtube.com"),
    ("youtube", "youtu.be"),
    ("douyin", "douyin.com"),
    ("kuaishou", "kuaishou.com"),
    ("tieba", "tieba.baidu.com"),
    ("qq", "v.qq.com"),
)


def video_platform(url: str) -> str:
    """从链接推断视频平台（仅展示用）。"""
    host = (urlparse(url).netloc or "").lower()
    for name, domain in _PLATFORMS:
        if host == domain or host.endswith("." + domain):
            return name
    return host or "其他"


def build_record_response(rec: ClearRecord, map_obj: Map | None = None) -> dict:
    """炼金记录响应（含地图信息，便于列表直接渲染）。"""
    data = {
        "id": rec.id,
        "map_id": rec.map_id,
        "user_id": rec.user_id,
        "username": rec.username,
        "display_name": rec.display_name or rec.username,
        "avatar_url": rec.avatar_url,
        "profile_url": rec.profile_url,
        "video_url": rec.video_url,
        "video_platform": video_platform(rec.video_url),
        "note": rec.note or "",
        "cleared_on": rec.cleared_on or "",
        "is_fc": bool(rec.is_fc),
        "status": rec.status,
        "reject_reason": rec.reject_reason or "",
        "submitted_at": rec.submitted_at,
        "reviewed_at": rec.reviewed_at,
        "reviewed_by": rec.reviewed_by or "",
    }
    if map_obj is not None:
        data.update(
            {
                "map_name": map_obj.name,
                "map_author": map_obj.author or "",
                "map_difficulty_level": map_obj.difficulty_level,
                "map_difficulty_label": difficulty_label(map_obj.difficulty_level),
            }
        )
    return data


def build_player_response(
    *,
    user_id: str,
    username: str,
    display_name: str = "",
    avatar_url: str = "",
    profile_url: str = "",
    clear_count: int = 0,
    fc_count: int = 0,
    top_difficulty_level: int = -1,
    latest_at=None,
    banned: bool = False,
) -> dict:
    """玩家统计响应（个人主页 / 排行榜共用）。"""
    return {
        "user_id": str(user_id),
        "username": username,
        "display_name": display_name or username,
        "avatar_url": avatar_url or "",
        "profile_url": profile_url or "",
        "clear_count": clear_count,
        "fc_count": fc_count,
        "top_difficulty_level": top_difficulty_level,
        "top_difficulty_label": (
            difficulty_label(top_difficulty_level) if top_difficulty_level >= 0 else ""
        ),
        "latest_at": latest_at,
        "banned": banned,
    }


def build_map_response(map_obj: Map, clear_count: int = 0, top_tier: int | None = None) -> dict:
    """地图响应。"""
    return {
        "id": map_obj.id,
        "name": map_obj.name,
        "author": map_obj.author or "",
        "difficulty_level": map_obj.difficulty_level,
        "difficulty_label": difficulty_label(map_obj.difficulty_level),
        "description": map_obj.description or "",
        "download_url": map_obj.download_url or "",
        "cover_url": map_obj.cover_url or "",
        "created_by": map_obj.created_by or "",
        "created_at": map_obj.created_at,
        "updated_at": map_obj.updated_at,
        "clear_count": clear_count,
        "overflow": map_obj.difficulty_level is not None
        and map_obj.difficulty_level >= (top_tier or settings.top_tier),
    }


def banned_user_ids(db) -> list[str]:
    """被封禁玩家的 user_id 列表。"""
    return [u.user_id for u in db.query(User.user_id).filter(User.banned != 0).all()]


def exclude_banned(query, db, column=ClearRecord.user_id):
    """把被封禁玩家的炼金记录从**公开**查询里剔除（管理端不受影响）。"""
    ids = banned_user_ids(db)
    return query if not ids else query.filter(~column.in_(ids))
