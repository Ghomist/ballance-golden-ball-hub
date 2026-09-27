from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.config import settings
from app.database import Base

# 炼金记录状态
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"


# 难度未定义（表格里的「暂无定义」：还没有人一命通关，无法评档）
UNDEFINED_LABEL = "暂无定义"


def difficulty_label(level: int | None) -> str:
    """难度等级显示名：T0…T20，突破 T20 之后归入「T20+」档；等级未定义时显示「暂无定义」。"""
    if level is None:
        return UNDEFINED_LABEL
    if level >= settings.top_tier:
        return "T20+"
    return f"T{level}"


class Map(Base):
    """地图条目（含难度等级）"""

    __tablename__ = "maps"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    author = Column(String(255), default="")
    # 难度等级：T0 最低，越大越难；>= top_tier(20) 归入 T20+ 档；NULL = 暂无定义
    difficulty_level = Column(Integer, nullable=True, default=None, index=True)
    description = Column(Text, default="")
    # 地图下载/介绍链接（可为空，便于只做炼金证明收录）
    download_url = Column(String(1024), default="")
    cover_url = Column(String(1024), default="")
    # 录入者（Flarum username）
    created_by = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class ClearRecord(Base):
    """炼金成果：某玩家在某地图上的通关证明（视频链接）"""

    __tablename__ = "clear_records"
    # 每人每图一条：重复提交覆盖旧记录并重新进入审核
    __table_args__ = (UniqueConstraint("user_id", "map_id", name="uq_user_map"),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # 提交者（Flarum 身份，登录时从 JWT 解出）
    user_id = Column(String(64), nullable=False, index=True)
    username = Column(String(255), nullable=False, index=True)
    display_name = Column(String(255), default="")
    avatar_url = Column(String(1024), default="")
    profile_url = Column(String(1024), default="")

    map_id = Column(Integer, ForeignKey("maps.id"), nullable=False, index=True)

    video_url = Column(String(1024), nullable=False)
    note = Column(Text, default="")
    # 通关日期（由提交者填写，展示用；格式 YYYY-MM-DD）
    cleared_on = Column(String(32), default="")
    # FC 金：表格里填充了颜色的记录（社区里的一种特殊金），由提交者声明或管理员修正
    is_fc = Column(Boolean, default=False, nullable=False)

    status = Column(String(16), default=STATUS_PENDING, nullable=False, index=True)
    reject_reason = Column(Text, default="")

    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(255), default="")


class User(Base):
    """登录过的玩家（缓存 Flarum 资料 + 封禁标记）"""

    __tablename__ = "users"

    user_id = Column(String(64), primary_key=True)
    username = Column(String(255), nullable=False, index=True)
    display_name = Column(String(255), default="")
    avatar_url = Column(String(1024), default="")
    profile_url = Column(String(1024), default="")
    banned = Column(Integer, default=0, nullable=False)
    first_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, default=datetime.utcnow, nullable=False)
