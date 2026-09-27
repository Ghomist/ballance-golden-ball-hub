"""站点公开统计。"""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import STATUS_APPROVED, STATUS_PENDING, ClearRecord, Map
from app.schemas import StatsResponse
from app.serializers import exclude_banned

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsResponse, summary="站点统计")
def stats(db: Session = Depends(get_db)):
    approved = (
        exclude_banned(
            db.query(func.count(ClearRecord.id)).filter(ClearRecord.status == STATUS_APPROVED), db
        ).scalar()
        or 0
    )
    pending = (
        exclude_banned(
            db.query(func.count(ClearRecord.id)).filter(ClearRecord.status == STATUS_PENDING), db
        ).scalar()
        or 0
    )
    players = (
        exclude_banned(
            db.query(func.count(func.distinct(ClearRecord.user_id))).filter(
                ClearRecord.status == STATUS_APPROVED
            ),
            db,
        ).scalar()
        or 0
    )
    return {
        "maps": db.query(func.count(Map.id)).scalar() or 0,
        "records_approved": approved,
        "records_pending": pending,
        "players": players,
    }
