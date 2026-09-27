from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

security = HTTPBearer(auto_error=False)

_USER_FIELDS = ("user_id", "username", "display_name", "avatar_url", "profile_url", "is_admin")


def create_token(user: dict) -> str:
    """为登录用户签发我们的 JWT。"""
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.token_expire)
    payload = {k: user[k] for k in _USER_FIELDS}
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def verify_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """验证 JWT，有效返回 payload（含用户信息），否则 401。"""
    if credentials is None:
        raise HTTPException(status_code=401, detail="未提供认证信息")
    try:
        return jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token 无效")


def require_admin(payload: dict = Depends(verify_token)) -> dict:
    """仅管理员可访问。"""
    if not payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return payload


def optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """可选登录：带了有效 token 就返回 payload，否则返回 None（不报错）。"""
    if credentials is None:
        return None
    try:
        return jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None


def current_user_dict(payload: dict) -> dict:
    """从 JWT payload 取出可直接落库的用户字段。"""
    return {
        "user_id": str(payload.get("user_id", "")),
        "username": payload.get("username", ""),
        "display_name": payload.get("display_name") or payload.get("username", ""),
        "avatar_url": payload.get("avatar_url", ""),
        "profile_url": payload.get("profile_url", ""),
    }


def is_valid_video_url(url: str) -> bool:
    """只接受 http(s) 的绝对 URL。"""
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def parse_date(value: str) -> str:
    """校验 YYYY-MM-DD，返回归一化字符串；空值返回空串。"""
    value = (value or "").strip()
    if not value:
        return ""
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise HTTPException(status_code=400, detail="通关日期格式应为 YYYY-MM-DD")
