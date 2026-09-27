import json

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""

    # 数据库配置
    database_url: str = "sqlite:///./data/hub.db"

    # 论坛地址（Flarum 实例；同时是 oauth-center 的 OAuth provider base）
    forum_url: str = "https://forum.ballance.top"

    # JWT 过期时间（秒），默认 7 天
    token_expire: int = 604800

    # JWT 密钥（自动生成，也可手动指定）
    jwt_secret: str = "ballance-golden-ball-secret-change-me"

    # Flarum oauth-center（后端主导的授权码流程）
    oauth_client_id: str = ""
    oauth_client_secret: str = ""

    # 管理员 Flarum 用户名白名单
    admin_usernames: list[str] = ["ghomist"]

    # Flarum 数据库连接（只读，用于判定 Flarum 管理员组 group_id=1）；
    # 留空则只按 admin_usernames 白名单判定。
    flarum_db_url: str = ""

    # 前端对外地址（OAuth 登录回调后把浏览器导向这里，dev 为 vite 地址）
    frontend_url: str = "http://localhost:5173"

    # 难度等级上限：>= 该值的等级统一归入「T20+」档
    top_tier: int = 20

    # CORS 配置
    cors_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if v is None:
            return ["*"]
        if isinstance(v, str):
            if v == "*":
                return ["*"]
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("admin_usernames", mode="before")
    @classmethod
    def parse_admin_usernames(cls, v):
        """支持 JSON 数组或逗号分隔字符串。"""
        if v is None or v == "":
            return []
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if str(x).strip()]
            except (json.JSONDecodeError, ValueError):
                pass
            return [u.strip() for u in v.split(",") if u.strip()]
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return v


settings = Settings()
