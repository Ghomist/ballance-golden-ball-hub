from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

# 确保数据库目录存在
_db_file = settings.database_url.replace("sqlite:///", "")
if _db_file.startswith("./") or "/" in _db_file or "\\" in _db_file:
    Path(_db_file).parent.mkdir(parents=True, exist_ok=True)

# 创建数据库引擎
engine = create_engine(
    settings.database_url, connect_args={"check_same_thread": False}
)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
Base = declarative_base()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库表"""
    # 必须先 import models 以注册所有表
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_columns()


# 后续新增的列写在这里：本项目没上 Alembic，老库靠这段补列
_ADDED_COLUMNS = {
    "clear_records": {"is_fc": "BOOLEAN NOT NULL DEFAULT 0"},
}


def _ensure_columns():
    """轻量迁移：把后加的列补到已存在的老库上（表不在或列已有则跳过）。"""
    with engine.begin() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
            existing = {row[1] for row in rows}
            if not existing:
                continue
            for name, ddl in columns.items():
                if name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
