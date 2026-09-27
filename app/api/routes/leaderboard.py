"""首页排行榜：按难度档列出各地图及其通关者。"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import STATUS_APPROVED, UNDEFINED_LABEL, ClearRecord, Map, difficulty_label
from app.schemas import LeaderboardResponse
from app.serializers import build_player_response, exclude_banned

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=LeaderboardResponse, summary="按难度分档的通关榜单")
def leaderboard(
    include_empty: bool = Query(False, description="是否包含暂无通关记录的地图"),
    db: Session = Depends(get_db),
):
    """T0 → T20+ 分档：每档下列出该难度地图及已通过审核的通关者。"""
    maps = db.query(Map).order_by(Map.difficulty_level.desc(), Map.name.asc()).all()
    records = exclude_banned(
        db.query(ClearRecord)
        .filter(ClearRecord.status == STATUS_APPROVED)
        .order_by(ClearRecord.submitted_at.asc()),
        db,
    ).all()

    # 玩家总通关数（榜单里每个玩家的整体成绩）
    totals = dict(
        exclude_banned(
            db.query(ClearRecord.user_id, func.count(func.distinct(ClearRecord.map_id))).filter(
                ClearRecord.status == STATUS_APPROVED
            ),
            db,
        )
        .group_by(ClearRecord.user_id)
        .all()
    )
    top_levels: dict[str, int] = {}
    for rec in records:
        level = next((m.difficulty_level for m in maps if m.id == rec.map_id), None)
        if level is None:
            continue
        if level > top_levels.get(rec.user_id, -1):
            top_levels[rec.user_id] = level

    by_map: dict[int, list[dict]] = {}
    for rec in records:
        by_map.setdefault(rec.map_id, []).append(rec)

    tiers: dict[str, dict] = {}
    for map_obj in maps:
        clears = by_map.get(map_obj.id, [])
        if not clears and not include_empty:
            continue
        label = difficulty_label(map_obj.difficulty_level)
        tier = tiers.setdefault(
            label,
            {"label": label, "level": map_obj.difficulty_level, "min_level": map_obj.difficulty_level, "maps": []},
        )
        if map_obj.difficulty_level is not None:
            if tier["min_level"] is None:
                tier["min_level"] = map_obj.difficulty_level
                tier["level"] = map_obj.difficulty_level
            else:
                tier["min_level"] = min(tier["min_level"], map_obj.difficulty_level)
                tier["level"] = max(tier["level"], map_obj.difficulty_level)
        tier["maps"].append(
            {
                "id": map_obj.id,
                "name": map_obj.name,
                "author": map_obj.author or "",
                "difficulty_level": map_obj.difficulty_level,
                "difficulty_label": label,
                "clear_count": len(clears),
                "cleared_by": [
                    build_player_response(
                        user_id=r.user_id,
                        username=r.username,
                        display_name=r.display_name,
                        avatar_url=r.avatar_url,
                        profile_url=r.profile_url,
                        clear_count=totals.get(r.user_id, 0),
                        top_difficulty_level=top_levels.get(r.user_id, -1),
                        latest_at=r.submitted_at,
                        banned=False,
                    )
                    for r in clears
                ],
            }
        )

    # 「暂无定义」档排最前，其余按难度从高到低
    ordered = sorted(
        tiers.values(), key=lambda t: (t["min_level"] is not None, -(t["min_level"] or 0))
    )
    for tier in ordered:
        # T20+ 档：档内按实际等级从高到低；未定义等级的排最后
        tier["maps"].sort(
            key=lambda m: (
                m["difficulty_level"] is not None,
                -(m["difficulty_level"] or 0),
                m["name"],
            )
        )
    return {"tiers": ordered}


@router.get("/edges", summary="难度档边界（前端展示用）")
def edges():
    """前端用来渲染 T0…T20+ 阶梯的边界信息。"""
    return {
        "top_tier": settings.top_tier,
        "undefined_label": UNDEFINED_LABEL,
        "labels": [difficulty_label(i) for i in range(0, settings.top_tier + 1)],
    }
