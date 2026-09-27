from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import (
    current_user_dict,
    is_valid_video_url,
    optional_user,
    parse_date,
    require_admin,
    verify_token,
)
from app.database import get_db
from app.models import (
    STATUS_APPROVED,
    STATUS_PENDING,
    STATUS_REJECTED,
    ClearRecord,
    Map,
    User,
    difficulty_label,
)
from app.schemas import RecordCreate, RecordListResponse, RecordResponse, RecordReview
from app.serializers import build_record_response, exclude_banned

router = APIRouter(prefix="/records", tags=["records"])


def _map_or_404(db: Session, map_id: int) -> Map:
    map_obj = db.query(Map).filter(Map.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="地图不存在")
    return map_obj


def _sync_user(db: Session, user: dict) -> None:
    """落库/刷新本地用户资料，封禁用户拒绝提交。"""
    row = db.query(User).filter(User.user_id == user["user_id"]).first()
    if row is None:
        row = User(user_id=user["user_id"], username=user["username"])
        db.add(row)
    elif row.banned:
        raise HTTPException(status_code=403, detail="该账号已被封禁，无法提交炼金成果")
    row.username = user["username"]
    row.display_name = user["display_name"]
    row.avatar_url = user["avatar_url"]
    row.profile_url = user["profile_url"]
    db.commit()


@router.post("", response_model=RecordResponse, summary="提交/更新我的炼金成果")
def submit_record(
    payload: RecordCreate,
    db: Session = Depends(get_db),
    auth: dict = Depends(verify_token),
):
    """每人每图一条记录：重复提交会覆盖旧链接并重新进入待审核。"""
    user = current_user_dict(auth)
    _sync_user(db, user)
    _map_or_404(db, payload.map_id)

    video_url = payload.video_url.strip()
    if not is_valid_video_url(video_url):
        raise HTTPException(status_code=400, detail="视频链接必须是完整的 http(s) 地址")
    cleared_on = parse_date(payload.cleared_on)

    rec = (
        db.query(ClearRecord)
        .filter(ClearRecord.user_id == user["user_id"], ClearRecord.map_id == payload.map_id)
        .first()
    )
    if rec is None:
        rec = ClearRecord(user_id=user["user_id"], map_id=payload.map_id, video_url=video_url)
        db.add(rec)
    # 重新提交即重新排队审核
    rec.username = user["username"]
    rec.display_name = user["display_name"]
    rec.avatar_url = user["avatar_url"]
    rec.profile_url = user["profile_url"]
    rec.video_url = video_url
    rec.note = payload.note.strip()
    rec.cleared_on = cleared_on
    rec.is_fc = bool(payload.is_fc)
    rec.status = STATUS_PENDING
    rec.reject_reason = ""
    rec.submitted_at = datetime.utcnow()
    rec.reviewed_at = None
    rec.reviewed_by = ""
    db.commit()
    db.refresh(rec)
    return build_record_response(rec, db.get(Map, rec.map_id))


@router.get("", response_model=RecordListResponse, summary="炼金记录列表")
def list_records(
    map_id: int | None = Query(None),
    user_id: str | None = Query(None),
    status: str = Query("", description="pending|approved|rejected，仅管理员可用"),
    fc_only: bool = Query(False, description="只看 FC 金"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    auth: dict | None = Depends(optional_user),
):
    """公开只能看到已通过的记录；管理员可按状态查询全部。"""
    query = db.query(ClearRecord)
    if map_id is not None:
        query = query.filter(ClearRecord.map_id == map_id)
    if user_id:
        query = query.filter(ClearRecord.user_id == user_id)
    if fc_only:
        query = query.filter(ClearRecord.is_fc.is_(True))
    wants_status = status in (STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED)
    is_admin = bool(auth and auth.get("is_admin"))
    if not is_admin:
        # 公开列表里不展示被封禁玩家的记录
        query = exclude_banned(query, db)
    if wants_status and not is_admin:
        raise HTTPException(status_code=403, detail="只有管理员可以按审核状态筛选")
    if wants_status:
        query = query.filter(ClearRecord.status == status)
    else:
        query = query.filter(ClearRecord.status == STATUS_APPROVED)
    query = query.order_by(ClearRecord.submitted_at.desc())

    total = query.count()
    rows = query.offset(skip).limit(limit).all()
    maps = {m.id: m for m in db.query(Map).filter(Map.id.in_([r.map_id for r in rows])).all()}
    return {
        "total": total,
        "items": [build_record_response(r, maps.get(r.map_id)) for r in rows],
    }


@router.get("/mine", response_model=RecordListResponse, summary="我的炼金记录")
def my_records(
    fc_only: bool = Query(False, description="只看 FC 金"),
    db: Session = Depends(get_db),
    auth: dict = Depends(verify_token),
):
    user_id = str(auth.get("user_id", ""))
    query = db.query(ClearRecord).filter(ClearRecord.user_id == user_id)
    if fc_only:
        query = query.filter(ClearRecord.is_fc.is_(True))
    rows = query.order_by(ClearRecord.submitted_at.desc()).all()
    maps = {m.id: m for m in db.query(Map).filter(Map.id.in_([r.map_id for r in rows])).all()}
    return {
        "total": len(rows),
        "items": [build_record_response(r, maps.get(r.map_id)) for r in rows],
    }


@router.get(
    "/by-tier",
    summary="按难度档聚合的最新炼金记录（首页「按难度分组」模式）",
)
def records_by_tier(
    per_tier: int = Query(3, ge=1, le=20, description="每档保留的记录数"),
    db: Session = Depends(get_db),
):
    """每个难度档取最近 N 条已通过的记录（跨该档所有地图），档位顺序与榜单一致：暂无定义 → T20+ → T0。"""
    maps = {m.id: m for m in db.query(Map).all()}
    rows = exclude_banned(
        db.query(ClearRecord)
        .filter(ClearRecord.status == STATUS_APPROVED)
        .order_by(ClearRecord.submitted_at.desc()),
        db,
    ).all()

    tiers: dict[str, dict] = {}
    for rec in rows:
        map_obj = maps.get(rec.map_id)
        if map_obj is None:
            continue
        label = difficulty_label(map_obj.difficulty_level)
        tier = tiers.setdefault(
            label,
            {
                "label": label,
                "level": map_obj.difficulty_level,
                "min_level": map_obj.difficulty_level,
                "map_ids": set(),
                "clear_count": 0,
                "records": [],
            },
        )
        tier["map_ids"].add(map_obj.id)
        tier["clear_count"] += 1
        if map_obj.difficulty_level is not None:
            if tier["min_level"] is None or map_obj.difficulty_level < tier["min_level"]:
                tier["min_level"] = map_obj.difficulty_level
            if tier["level"] is None or map_obj.difficulty_level > tier["level"]:
                tier["level"] = map_obj.difficulty_level
        if len(tier["records"]) < per_tier:
            tier["records"].append(build_record_response(rec, map_obj))

    # 「暂无定义」档排最前，其余按难度从高到低
    ordered = sorted(
        tiers.values(), key=lambda t: (t["min_level"] is not None, -(t["min_level"] or 0))
    )
    return {
        "tiers": [
            {
                "label": tier["label"],
                "level": tier["level"],
                "min_level": tier["min_level"],
                "map_count": len(tier["map_ids"]),
                "clear_count": tier["clear_count"],
                "records": tier["records"],
            }
            for tier in ordered
        ]
    }


@router.delete("/{record_id}", summary="删除炼金记录（本人或管理员）")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    auth: dict = Depends(verify_token),
):
    rec = db.query(ClearRecord).filter(ClearRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="记录不存在")
    if rec.user_id != str(auth.get("user_id", "")) and not auth.get("is_admin"):
        raise HTTPException(status_code=403, detail="只能删除自己的记录")
    db.delete(rec)
    db.commit()
    return {"ok": True}


@router.post("/{record_id}/review", response_model=RecordResponse, summary="审核炼金记录（管理员）")
def review_record(
    record_id: int,
    payload: RecordReview,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_admin),
):
    rec = db.query(ClearRecord).filter(ClearRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="记录不存在")

    if payload.action == "approve":
        rec.status = STATUS_APPROVED
        rec.reject_reason = ""
    else:
        rec.status = STATUS_REJECTED
        rec.reject_reason = payload.reason.strip() or "未通过审核"
    rec.reviewed_at = datetime.utcnow()
    rec.reviewed_by = auth.get("username", "")
    if payload.is_fc is not None:
        rec.is_fc = bool(payload.is_fc)
    db.commit()
    db.refresh(rec)
    return build_record_response(rec, db.get(Map, rec.map_id))
