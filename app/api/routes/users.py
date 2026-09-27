"""玩家排行与个人主页。"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import optional_user
from app.database import get_db
from app.models import STATUS_APPROVED, ClearRecord, Map, User
from app.schemas import PlayerDetailResponse, PlayerListResponse
from app.serializers import build_player_response, build_record_response, exclude_banned

router = APIRouter(prefix="/users", tags=["users"])


def _player_rows(db: Session):
    """按玩家聚合已通过的炼金记录（不含被封禁玩家）。"""
    return exclude_banned(
        db.query(
            ClearRecord.user_id,
            ClearRecord.username,
            ClearRecord.display_name,
            ClearRecord.avatar_url,
            ClearRecord.profile_url,
            func.count(func.distinct(ClearRecord.map_id)).label("clear_count"),
            func.max(Map.difficulty_level).label("top_level"),
            func.max(ClearRecord.submitted_at).label("latest_at"),
        )
        .join(Map, Map.id == ClearRecord.map_id)
        .filter(ClearRecord.status == STATUS_APPROVED)
        .group_by(ClearRecord.user_id),
        db,
    )


@router.get("", response_model=PlayerListResponse, summary="玩家排行")
def list_players(
    sort: str = Query("clears", description="clears|difficulty|recent"),
    q: str = Query("", description="按用户名/昵称模糊搜索"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """按通关数 / 最高难度 / 最近提交排序的玩家榜。"""
    query = _player_rows(db)
    # FC 金数量：单独聚合一次（与主查询的 group by 互不干扰）
    fc_counts = dict(
        exclude_banned(
            db.query(ClearRecord.user_id, func.count(func.distinct(ClearRecord.map_id))).filter(
                ClearRecord.status == STATUS_APPROVED, ClearRecord.is_fc.is_(True)
            ),
            db,
        )
        .group_by(ClearRecord.user_id)
        .all()
    )
    if q:
        kw = f"%{q.strip()}%"
        query = query.filter(
            ClearRecord.username.like(kw) | ClearRecord.display_name.like(kw)
        )
    if sort == "difficulty":
        query = query.order_by(func.max(Map.difficulty_level).desc(), func.count(ClearRecord.id).desc())
    elif sort == "recent":
        query = query.order_by(func.max(ClearRecord.submitted_at).desc())
    else:
        query = query.order_by(func.count(func.distinct(ClearRecord.map_id)).desc(), func.max(Map.difficulty_level).desc())

    total = query.count()
    rows = query.offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [
            build_player_response(
                user_id=r.user_id,
                username=r.username,
                display_name=r.display_name,
                avatar_url=r.avatar_url,
                profile_url=r.profile_url,
                clear_count=r.clear_count,
                fc_count=fc_counts.get(r.user_id, 0),
                top_difficulty_level=r.top_level if r.top_level is not None else -1,
                latest_at=r.latest_at,
                banned=False,
            )
            for r in rows
        ],
    }


@router.get("/{user_id}", response_model=PlayerDetailResponse, summary="玩家个人主页")
def get_player(
    user_id: str,
    db: Session = Depends(get_db),
    auth: dict | None = Depends(optional_user),
):
    """玩家资料 + 其炼金记录（仅本人/管理员能看到未通过的记录）。"""
    is_self = bool(auth and str(auth.get("user_id")) == user_id)
    is_admin = bool(auth and auth.get("is_admin"))

    query = db.query(ClearRecord).filter(ClearRecord.user_id == user_id)
    if not (is_self or is_admin):
        query = query.filter(ClearRecord.status == STATUS_APPROVED)
    rows = query.order_by(ClearRecord.submitted_at.desc()).all()

    user_row = db.query(User).filter(User.user_id == user_id).first()
    if user_row is not None and user_row.banned and not (is_self or is_admin):
        raise HTTPException(status_code=404, detail="该玩家已被封禁")
    if not rows and user_row is None:
        raise HTTPException(status_code=404, detail="玩家不存在")

    approved = [r for r in rows if r.status == STATUS_APPROVED]
    map_ids = [r.map_id for r in approved]
    levels = [
        lvl
        for (lvl,) in db.query(Map.difficulty_level).filter(Map.id.in_(map_ids)).all()
        if lvl is not None  # 「暂无定义」不计入最高难度
    ] if map_ids else []

    source = rows[0] if rows else user_row
    maps = {m.id: m for m in db.query(Map).filter(Map.id.in_([r.map_id for r in rows])).all()}
    base = build_player_response(
        user_id=user_id,
        username=source.username,
        display_name=source.display_name or "",
        avatar_url=source.avatar_url or "",
        profile_url=source.profile_url or "",
        clear_count=len(approved),
        fc_count=sum(1 for r in approved if r.is_fc),
        top_difficulty_level=max(levels) if levels else -1,
        latest_at=rows[0].submitted_at if rows else None,
        banned=bool(user_row and user_row.banned),
    )
    return {**base, "records": [build_record_response(r, maps.get(r.map_id)) for r in rows]}
