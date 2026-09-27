import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.config import settings
from app.database import get_db
from app.models import (
    STATUS_APPROVED,
    UNDEFINED_LABEL,
    ClearRecord,
    Map,
    difficulty_label,
)
from app.schemas import MapBulkCreate, MapCreate, MapListResponse, MapResponse
from app.serializers import build_map_response, exclude_banned

router = APIRouter(prefix="/maps", tags=["maps"])


def _approved_counts(db: Session, map_ids: list[int] | None = None) -> dict[int, int]:
    """各地图的已通过炼金记录数。"""
    q = (
        db.query(ClearRecord.map_id, func.count(ClearRecord.id))
        .filter(ClearRecord.status == STATUS_APPROVED)
        .group_by(ClearRecord.map_id)
    )
    q = exclude_banned(q, db)
    if map_ids:
        q = q.filter(ClearRecord.map_id.in_(map_ids))
    return {mid: cnt for mid, cnt in q.all()}


# 难度筛选里把「暂无定义」也能当一档用
UNDEFINED_TIER_KEYS = {UNDEFINED_LABEL.lower(), "未定义", "undefined", "none", "null", "-"}


def _parse_tier(tier: str) -> tuple[int | None, bool]:
    """解析「T5」/「T20+」/「暂无定义」→ (等级, 是否上限档)；等级为 None 表示未定义档。"""
    key = tier.strip()
    if key.lower() in UNDEFINED_TIER_KEYS:
        return None, False
    m = re.fullmatch(r"[Tt](\d+)(\+)?", key)
    if not m:
        raise HTTPException(status_code=400, detail="难度筛选格式应为 T0~T20、T20+ 或 暂无定义")
    level = int(m.group(1))
    return level, bool(m.group(2)) or level >= settings.top_tier


@router.get("", response_model=MapListResponse, summary="地图列表")
def list_maps(
    q: str = Query("", description="按地图名/作者模糊搜索"),
    tier: str = Query("", description="难度档筛选，如 T5 或 T20+"),
    sort: str = Query("difficulty_desc", description="difficulty_desc|difficulty_asc|name|newest|clears"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """公开的地图库列表（含各图通关人数）。"""
    query = db.query(Map)
    if q:
        kw = f"%{q.strip()}%"
        query = query.filter(Map.name.like(kw) | Map.author.like(kw))
    if tier:
        level, is_top = _parse_tier(tier)
        if level is None:
            query = query.filter(Map.difficulty_level.is_(None))
        elif is_top:
            query = query.filter(Map.difficulty_level >= level)
        else:
            query = query.filter(Map.difficulty_level == level)

    # 「暂无定义」视为待评的最高档：降序排最前，升序排最后
    undefined_last = case((Map.difficulty_level.is_(None), 1), else_=0)
    undefined_first = case((Map.difficulty_level.is_(None), 0), else_=1)
    if sort == "difficulty_asc":
        query = query.order_by(undefined_last, Map.difficulty_level.asc(), Map.name.asc())
    elif sort == "name":
        query = query.order_by(Map.name.asc())
    elif sort == "newest":
        query = query.order_by(Map.created_at.desc())
    elif sort == "clears":
        counts = _approved_counts(db)
        ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        total = len(ranked)
        page = ranked[skip : skip + limit]
        maps = {m.id: m for m in db.query(Map).filter(Map.id.in_([i for i, _ in page])).all()}
        items = [
            build_map_response(maps[mid], cnt)
            for mid, cnt in page
            if mid in maps
        ]
        return {"total": total, "items": items}
    else:
        query = query.order_by(undefined_first, Map.difficulty_level.desc(), Map.name.asc())

    total = query.count()
    maps = query.offset(skip).limit(limit).all()
    counts = _approved_counts(db, [m.id for m in maps])
    return {
        "total": total,
        "items": [build_map_response(m, counts.get(m.id, 0)) for m in maps],
    }


@router.get("/difficulties", summary="现有难度档列表")
def list_difficulties(db: Session = Depends(get_db)):
    """返回库中已有的难度档（含 T20+ 合并档与「暂无定义」档），供前端筛选器使用。"""
    rows = (
        db.query(Map.difficulty_level, func.count(Map.id))
        .group_by(Map.difficulty_level)
        .all()
    )
    tiers: dict[str, dict] = {}
    for level, count in rows:
        label = difficulty_label(level)
        tier = tiers.setdefault(
            label, {"label": label, "min_level": level, "levels": [], "maps": 0}
        )
        if level is not None:
            if tier["min_level"] is None or level < tier["min_level"]:
                tier["min_level"] = level
            tier["levels"].append(level)
        tier["maps"] += count
    # 「暂无定义」排最前，其余按难度从高到低
    ordered = sorted(
        tiers.values(), key=lambda t: (t["min_level"] is not None, -(t["min_level"] or 0))
    )
    return {"top_tier": settings.top_tier, "tiers": ordered}


@router.get("/{map_id}", response_model=MapResponse, summary="地图详情")
def get_map(map_id: int, db: Session = Depends(get_db)):
    map_obj = db.query(Map).filter(Map.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="地图不存在")
    counts = _approved_counts(db, [map_obj.id])
    return build_map_response(map_obj, counts.get(map_obj.id, 0))


@router.post("", response_model=MapResponse, summary="新建地图（管理员）")
def create_map(
    payload: MapCreate,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_admin),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="地图名不能为空")
    if db.query(Map).filter(func.lower(Map.name) == name.lower()).first():
        raise HTTPException(status_code=400, detail="同名地图已存在")

    map_obj = Map(
        name=name,
        author=payload.author.strip(),
        difficulty_level=payload.difficulty_level,
        description=payload.description.strip(),
        download_url=payload.download_url.strip(),
        cover_url=payload.cover_url.strip(),
        created_by=auth.get("username", ""),
    )
    db.add(map_obj)
    db.commit()
    db.refresh(map_obj)
    return build_map_response(map_obj, 0)


@router.put("/{map_id}", response_model=MapResponse, summary="编辑地图（管理员）")
def update_map(
    map_id: int,
    payload: MapCreate,
    db: Session = Depends(get_db),
    _auth: dict = Depends(require_admin),
):
    map_obj = db.query(Map).filter(Map.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="地图不存在")

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="地图名不能为空")
    dup = (
        db.query(Map)
        .filter(func.lower(Map.name) == name.lower(), Map.id != map_id)
        .first()
    )
    if dup:
        raise HTTPException(status_code=400, detail="同名地图已存在")

    map_obj.name = name
    map_obj.author = payload.author.strip()
    map_obj.difficulty_level = payload.difficulty_level
    map_obj.description = payload.description.strip()
    map_obj.download_url = payload.download_url.strip()
    map_obj.cover_url = payload.cover_url.strip()
    db.commit()
    db.refresh(map_obj)
    counts = _approved_counts(db, [map_obj.id])
    return build_map_response(map_obj, counts.get(map_obj.id, 0))


@router.delete("/{map_id}", summary="删除地图及其炼金记录（管理员）")
def delete_map(
    map_id: int,
    db: Session = Depends(get_db),
    _auth: dict = Depends(require_admin),
):
    map_obj = db.query(Map).filter(Map.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="地图不存在")
    db.query(ClearRecord).filter(ClearRecord.map_id == map_id).delete()
    db.delete(map_obj)
    db.commit()
    return {"ok": True}


@router.post("/bulk", summary="批量导入地图（管理员）")
def bulk_create_maps(
    payload: MapBulkCreate,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_admin),
):
    """每行一条：「地图名,作者,难度」。已存在的同名地图更新作者与难度。"""
    created, updated, skipped = 0, 0, []
    for raw in payload.text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.replace("\t", ",").split(",")]
        name = parts[0]
        if not name:
            continue
        raw_level = parts[2] if len(parts) > 2 else ""
        if raw_level.lower() in UNDEFINED_TIER_KEYS or raw_level == "":
            level = None  # 不填或写「暂无定义」
        else:
            try:
                level = int(raw_level)
            except ValueError:
                skipped.append(line)
                continue
        existing = db.query(Map).filter(func.lower(Map.name) == name.lower()).first()
        if existing:
            existing.author = parts[1] if len(parts) > 1 else existing.author
            existing.difficulty_level = level
            updated += 1
        else:
            db.add(
                Map(
                    name=name,
                    author=parts[1] if len(parts) > 1 else "",
                    difficulty_level=level,
                    created_by=auth.get("username", ""),
                )
            )
            created += 1
    db.commit()
    return {"created": created, "updated": updated, "skipped": skipped}
