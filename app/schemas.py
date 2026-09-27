from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserInfo(BaseModel):
    """当前登录用户"""

    user_id: str
    username: str
    display_name: str
    avatar_url: str
    profile_url: str
    is_admin: bool


class MapCreate(BaseModel):
    """新建/编辑地图"""

    name: str = Field(..., min_length=1, max_length=255)
    author: str = ""
    difficulty_level: int | None = Field(None, ge=0, le=200, description="难度等级，留空=暂无定义")
    description: str = ""
    download_url: str = ""
    cover_url: str = ""


class MapResponse(BaseModel):
    id: int
    name: str
    author: str = ""
    difficulty_level: int | None = None
    difficulty_label: str
    description: str = ""
    download_url: str = ""
    cover_url: str = ""
    created_by: str = ""
    created_at: datetime
    updated_at: datetime
    clear_count: int = 0
    overflow: bool = False


class MapListResponse(BaseModel):
    total: int
    items: list[MapResponse] = Field(default_factory=list)


class MapBulkCreate(BaseModel):
    """批量导入地图：每行「名称,作者,难度」"""

    text: str


class RecordCreate(BaseModel):
    """提交/更新炼金成果"""

    map_id: int
    video_url: str = Field(..., min_length=1, max_length=1024)
    note: str = ""
    cleared_on: str = ""
    is_fc: bool = False


class RecordReview(BaseModel):
    """审核炼金记录"""

    action: str = Field(..., pattern="^(approve|reject)$")
    reason: str = ""
    # 管理员可在审核时修正 FC 金标记；不传则保持提交者的声明
    is_fc: Optional[bool] = None


class RecordResponse(BaseModel):
    id: int
    map_id: int
    user_id: str
    username: str
    display_name: str
    avatar_url: str = ""
    profile_url: str = ""
    video_url: str
    video_platform: str = ""
    note: str = ""
    cleared_on: str = ""
    is_fc: bool = False
    status: str
    reject_reason: str = ""
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: str = ""
    map_name: Optional[str] = None
    map_author: Optional[str] = None
    map_difficulty_level: Optional[int] = None
    map_difficulty_label: Optional[str] = None


class RecordListResponse(BaseModel):
    total: int
    items: list[RecordResponse] = Field(default_factory=list)


class PlayerResponse(BaseModel):
    """玩家（个人主页 / 排行）"""

    user_id: str
    username: str
    display_name: str
    avatar_url: str = ""
    profile_url: str = ""
    clear_count: int = 0
    fc_count: int = 0
    top_difficulty_level: int = -1
    top_difficulty_label: str = ""
    latest_at: Optional[datetime] = None
    banned: bool = False


class PlayerListResponse(BaseModel):
    total: int
    items: list[PlayerResponse] = Field(default_factory=list)


class PlayerDetailResponse(PlayerResponse):
    records: list[RecordResponse] = Field(default_factory=list)


class LeaderboardMap(BaseModel):
    id: int
    name: str
    author: str = ""
    difficulty_level: int | None = None  # None = 暂无定义
    difficulty_label: str
    clear_count: int = 0
    cleared_by: list[PlayerResponse] = Field(default_factory=list)


class LeaderboardTier(BaseModel):
    label: str
    level: int | None = None  # 「暂无定义」档为 None
    min_level: int | None = None
    maps: list[LeaderboardMap] = Field(default_factory=list)


class LeaderboardResponse(BaseModel):
    tiers: list[LeaderboardTier] = Field(default_factory=list)


class StatsResponse(BaseModel):
    maps: int = 0
    records_approved: int = 0
    records_pending: int = 0
    players: int = 0


class UserBanUpdate(BaseModel):
    banned: bool
