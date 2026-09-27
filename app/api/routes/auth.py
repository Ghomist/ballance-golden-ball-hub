import asyncio
import hashlib
import hmac
import secrets
from datetime import datetime
from typing import Optional
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.auth import create_token, verify_token
from app.config import settings
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _oauth(path: str) -> str:
    """Flarum oauth-center 端点地址（基于 forum_url）。"""
    return f"{settings.forum_url.rstrip('/')}/{path.lstrip('/')}"


# 无状态签名 state：nonce + HMAC。回调只验签，不依赖 cookie，规避 dev 下
# localhost/127.0.0.1 跨站 cookie 丢失问题。
def _make_state() -> str:
    nonce = secrets.token_urlsafe(16)
    sig = hmac.new(settings.jwt_secret.encode(), nonce.encode(), hashlib.sha256).hexdigest()[:24]
    return f"{nonce}.{sig}"


def _check_state(state: str) -> bool:
    try:
        nonce, sig = state.rsplit(".", 1)
    except ValueError:
        return False
    expected = hmac.new(settings.jwt_secret.encode(), nonce.encode(), hashlib.sha256).hexdigest()[:24]
    return hmac.compare_digest(sig, expected)


# Flarum 库只读连接：判定管理员组（group_id=1）。FLARUM_DB_URL 留空则禁用。
_engine = None


def _is_flarum_admin(user_id: str) -> bool:
    if not settings.flarum_db_url or not str(user_id).isdigit():
        return False
    global _engine
    try:
        if _engine is None:
            _engine = create_engine(settings.flarum_db_url, pool_pre_ping=True)
        with _engine.connect() as conn:
            row = conn.execute(
                text("SELECT 1 FROM group_user WHERE user_id = :uid AND group_id = 1 LIMIT 1"),
                {"uid": int(user_id)},
            ).first()
        return row is not None
    except Exception:
        # DB 不可达/表缺失时不阻塞登录，降级为仅白名单判定。
        return False


@router.get("/login", summary="跳转 Flarum OAuth 登录")
def login(request: Request):
    """把浏览器重定向到 Flarum oauth-center 授权端点。"""
    redirect_uri = str(request.url_for("auth_callback"))
    params = {
        "client_id": settings.oauth_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "user.read",
        "state": _make_state(),
    }
    return RedirectResponse(url=f"{_oauth('/oauth/authorize')}?{urlencode(params)}")


def _frontend_redirect(fragment: str = "") -> RedirectResponse:
    """把浏览器导回前端（token / 错误信息放在 fragment 里，避免落到后端路由）。"""
    base = settings.frontend_url.rstrip("/")
    return RedirectResponse(url=f"{base}/#{fragment}" if fragment else f"{base}/")


@router.get("/callback", name="auth_callback", summary="Flarum OAuth 登录回调")
async def callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """用授权码换 token，签发我们的 JWT 后把浏览器导回前端。"""
    # 用户取消或 Flarum 返回错误时直接回首页
    if not code:
        return _frontend_redirect()
    if not state or not _check_state(state):
        raise HTTPException(status_code=400, detail="认证状态校验失败，请重新登录")

    redirect_uri = str(request.url_for("auth_callback"))
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": settings.oauth_client_id,
        "client_secret": settings.oauth_client_secret,
    }
    async with httpx.AsyncClient(timeout=10.0, trust_env=False) as client:
        try:
            r = await client.post(
                _oauth("/oauth/token"),
                data=token_data,
                headers={"Accept": "application/json"},
            )
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="无法连接到 Flarum")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Flarum 授权码换取失败: {r.text}")
        access_token = r.json().get("access_token", "")

        try:
            r = await client.get(
                _oauth("/api/user"),
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="无法获取用户资料")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="无法获取用户资料")
        info = r.json()

    username = info.get("username") or str(info.get("id", ""))
    user_id = str(info.get("id", ""))
    avatar = info.get("avatar_url") or ""
    # Flarum 的 avatar_url 可能是相对路径，补成绝对。
    if avatar and not avatar.startswith("http"):
        avatar = f"{settings.forum_url.rstrip('/')}/{avatar.lstrip('/')}"
    flarum_admin = await asyncio.to_thread(_is_flarum_admin, user_id)

    # 记录/更新本地用户，封禁用户直接拒之门外
    user_row = db.query(User).filter(User.user_id == user_id).first()
    if user_row is None:
        user_row = User(user_id=user_id, username=username)
        db.add(user_row)
    else:
        if user_row.banned:
            return _frontend_redirect(f"error={quote('该账号已被封禁，如有疑问请联系管理员')}")
        user_row.username = username
    user_row.display_name = info.get("nickname") or username
    user_row.avatar_url = avatar
    user_row.profile_url = f"{settings.forum_url.rstrip('/')}/u/{username}"
    user_row.last_login_at = datetime.utcnow()
    db.commit()

    user = {
        "user_id": user_id,
        "username": username,
        "display_name": user_row.display_name,
        "avatar_url": avatar,
        "profile_url": user_row.profile_url,
        "is_admin": username in settings.admin_usernames or flarum_admin,
    }
    return _frontend_redirect(f"token={create_token(user)}")


@router.get("/me", summary="当前用户信息")
def me(payload: dict = Depends(verify_token)):
    """从 JWT 还原当前用户"""
    return {
        **{
            k: payload.get(k, "")
            for k in ("user_id", "username", "display_name", "avatar_url", "profile_url")
        },
        "is_admin": bool(payload.get("is_admin", False)),
    }
