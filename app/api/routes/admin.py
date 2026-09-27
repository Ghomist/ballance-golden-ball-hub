"""管理员：待审列表、玩家封禁。"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.config import settings
from app.database import get_db
from app.models import STATUS_APPROVED, STATUS_PENDING, STATUS_REJECTED, ClearRecord, Map, User
from app.schemas import PlayerListResponse, RecordListResponse, UserBanUpdate
from app.serializers import build_player_response, build_record_response

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/pending", response_model=RecordListResponse, summary="待审核炼金记录")
def pending_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _auth: dict = Depends(require_admin),
):
    query = (
        db.query(ClearRecord)
        .filter(ClearRecord.status == STATUS_PENDING)
        .order_by(ClearRecord.submitted_at.asc())
    )
    total = query.count()
    rows = query.offset(skip).limit(limit).all()
    maps = {m.id: m for m in db.query(Map).filter(Map.id.in_([r.map_id for r in rows])).all()}
    return {
        "total": total,
        "items": [build_record_response(r, maps.get(r.map_id)) for r in rows],
    }


@router.get("/overview", summary="审核台概览")
def overview(
    db: Session = Depends(get_db),
    _auth: dict = Depends(require_admin),
):
    def count(status: str) -> int:
        return db.query(func.count(ClearRecord.id)).filter(ClearRecord.status == status).scalar() or 0

    return {
        "pending": count(STATUS_PENDING),
        "approved": count(STATUS_APPROVED),
        "rejected": count(STATUS_REJECTED),
        "maps": db.query(func.count(Map.id)).scalar() or 0,
        "users": db.query(func.count(User.user_id)).scalar() or 0,
    }


@router.get("/users", response_model=PlayerListResponse, summary="全部玩家（含封禁状态）")
def admin_users(
    q: str = Query(""),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    _auth: dict = Depends(require_admin),
):
    query = db.query(User)
    if q:
        kw = f"%{q.strip()}%"
        query = query.filter(User.username.like(kw) | User.display_name.like(kw))
    users = query.order_by(User.last_login_at.desc()).limit(limit).all()

    counts = dict(
        db.query(ClearRecord.user_id, func.count(ClearRecord.id))
        .filter(ClearRecord.status == STATUS_APPROVED)
        .group_by(ClearRecord.user_id)
        .all()
    )
    levels = dict(
        db.query(ClearRecord.user_id, func.max(Map.difficulty_level))
        .join(Map, Map.id == ClearRecord.map_id)
        .filter(ClearRecord.status == STATUS_APPROVED)
        .group_by(ClearRecord.user_id)
        .all()
    )
    return {
        "total": len(users),
        "items": [
            build_player_response(
                user_id=u.user_id,
                username=u.username,
                display_name=u.display_name,
                avatar_url=u.avatar_url,
                profile_url=u.profile_url,
                clear_count=counts.get(u.user_id, 0),
                top_difficulty_level=levels.get(u.user_id, -1) if levels.get(u.user_id) is not None else -1,
                latest_at=u.last_login_at,
                banned=bool(u.banned),
            )
            for u in users
        ],
    }


@router.post("/users/{user_id}/ban", summary="封禁 / 解封玩家")
def set_ban(
    user_id: str,
    payload: UserBanUpdate,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_admin),
):
    user_row = db.query(User).filter(User.user_id == user_id).first()
    if not user_row:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user_row.username == auth.get("username") or user_row.username in settings.admin_usernames:
        raise HTTPException(status_code=400, detail="不能封禁管理员")
    user_row.banned = 1 if payload.banned else 0
    db.commit()
    return {"ok": True, "banned": bool(user_row.banned)}
