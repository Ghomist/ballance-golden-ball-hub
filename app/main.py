from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.routes import admin, auth, leaderboard, maps, records, stats, users
from app.config import settings
from app.database import init_db

app = FastAPI(
    title="Ballance 炼金成果站 API",
    description="玩家炼金（通关）证明收录 + 地图难度分级（T0 → T20+）",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(maps.router, prefix="/api")
app.include_router(records.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.on_event("startup")
def startup_event():
    """应用启动时初始化数据库"""
    init_db()


@app.get("/api/health", summary="健康检查")
def health():
    return {"status": "healthy"}


# 托管前端静态文件（SPA：命中文件就返回文件，否则回退 index.html）
static_dir = (Path(__file__).parent.parent / "web" / "dist").resolve()


@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")

    if static_dir.is_dir():
        candidate = (static_dir / full_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(static_dir):
            return FileResponse(candidate)
        index = static_dir / "index.html"
        if index.is_file():
            return FileResponse(index)

    raise HTTPException(status_code=404, detail="前端还未构建，请在 web/ 目录执行 pnpm build")
