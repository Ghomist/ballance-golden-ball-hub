"""把 scripts/seed/ranking.json 预填进数据库：地图库 + 历史炼金记录。

数据来自《平衡球地图炼金难度排行.xlsx》（用 scripts/xlsx_to_seed.py 生成的 JSON）。

用法：
    uv run python scripts/seed_import.py            # 写入 settings.database_url 指向的库
    uv run python scripts/seed_import.py --dry-run  # 只看会做什么，不写库

说明：
  - 历史记录用 `legacy:<玩家名>` 作为 user_id、直接标记为已通过审核（reviewed_by=表格导入），
    note 里注明「历史收录」；视频链接取自《详细记录》单元格上的超链接（B 站）。
    玩家本人以后登录提交，算作他自己的账号记录，互不影响。
  - 幂等：同名地图按名字更新作者/难度（并补上表格里地图名的批注 = 该图特殊规则）；同一 (user_id, map_id) 记录
    已存在则跳过，但会把后来补上的视频链接、FC 标记、表格批注回填到旧记录上。
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import Base, SessionLocal, engine, init_db  # noqa: E402
from app.models import (  # noqa: E402
    STATUS_APPROVED,
    ClearRecord,
    Map,
)
from app.config import settings  # noqa: E402

SEED = Path(__file__).parent / "seed" / "ranking.json"
LEGACY_PREFIX = "legacy:"
LEGACY_NOTE = "历史收录（来自《平衡球地图炼金难度排行》表格）"


def norm(name: str) -> str:
    """归一化地图名用于匹配（括号全半角、空白、大小写）。"""
    s = name.strip().replace("（", "(").replace("）", ")").replace("　", "")
    return re.sub(r"\s+", "", s).lower()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="不写库，只打印将要执行的操作")
    ap.add_argument("--seed", default=str(SEED), help="种子 JSON 路径")
    args = ap.parse_args()

    seed = json.loads(Path(args.seed).read_text(encoding="utf-8"))
    init_db()  # 建表 + 补后加的列（不要直接用 create_all，老库不会补列）
    db = SessionLocal()
    print(f"数据库：{settings.database_url}")

    maps_by_norm = {norm(m.name): m for m in db.query(Map).all()}
    created_maps = updated_maps = filled_descriptions = 0

    for item in seed["maps"]:
        level = item["difficulty_level"]
        author = item.get("author") or ""
        description = item.get("description") or ""
        existing = maps_by_norm.get(norm(item["name"]))
        if existing:
            if existing.difficulty_level != level or (author and existing.author != author) or (
                description and existing.description != description
            ):
                existing.difficulty_level = level
                if author:
                    existing.author = author
                if description and existing.description != description:
                    existing.description = description
                    filled_descriptions += 1
                updated_maps += 1
            continue
        map_obj = Map(
            name=item["name"],
            author=author,
            difficulty_level=level,
            description=description,
            created_by="表格导入",
        )
        if not args.dry_run:
            db.add(map_obj)
            db.flush()
        maps_by_norm[norm(item["name"])] = map_obj
        created_maps += 1

    known_records = {
        (record.user_id, record.map_id): record for record in db.query(ClearRecord).all()
    }
    # 同一玩家同一地图在表格里可能有多次通关（再刷）：只留一条，记最早日期，其余写进 note
    agg: dict[tuple[str, int], dict] = {}
    order: list[tuple[str, int]] = []
    missing_maps = 0
    for item in seed["completions"]:
        map_obj = maps_by_norm.get(norm(item["map_name"]))
        if map_obj is None:
            # 详细记录里有、排行表里没收录的图：按详细记录的难度建，等级缺失则为「暂无定义」
            map_obj = Map(
                name=item["map_name"],
                author=item.get("map_author") or "",
                difficulty_level=item.get("difficulty_level"),
                description=item.get("description") or "",
                created_by="表格导入",
            )
            if not args.dry_run:
                db.add(map_obj)
                db.flush()
            else:
                map_obj.id = -len(maps_by_norm)  # dry-run 下给个临时 id 避免键冲突
            maps_by_norm[norm(item["map_name"])] = map_obj
            missing_maps += 1

        player = item["player"]
        key = (f"{LEGACY_PREFIX}{player}", map_obj.id)
        entry = agg.get(key)
        if entry is None:
            agg[key] = {
                "player": player,
                "map": map_obj,
                "dates": [item.get("cleared_on") or ""],
                "urls": [item.get("video_url") or ""],
                "fc": bool(item.get("is_fc")),
                "comments": [item.get("note") or ""],
            }
            order.append(key)
        else:
            entry["dates"].append(item.get("cleared_on") or "")
            entry["urls"].append(item.get("video_url") or "")
            entry["fc"] = entry["fc"] or bool(item.get("is_fc"))
            entry["comments"].append(item.get("note") or "")

    created_records = skipped_records = filled_videos = filled_fc = filled_notes = 0
    players = {entry["player"] for entry in agg.values()}
    for user_id, map_id in order:
        entry = agg[(user_id, map_id)]
        # 同一玩家同一地图可能有多条，取第一条带链接的
        video_url = next((u for u in entry["urls"] if u), "")
        comment = next((n for n in entry["comments"] if n), "")
        existing = known_records.get((user_id, map_id))
        if existing is not None:
            skipped_records += 1
            if video_url and existing.video_url != video_url:
                if not args.dry_run:
                    existing.video_url = video_url
                filled_videos += 1
            if entry["fc"] and not existing.is_fc:
                if not args.dry_run:
                    existing.is_fc = True
                filled_fc += 1
            if comment and existing.note.startswith(LEGACY_NOTE):
                if not args.dry_run:
                    existing.note = f"{comment}；{existing.note}"
                filled_notes += 1
            continue
        dates = sorted(d for d in entry["dates"] if d)
        cleared_on = dates[0] if dates else ""
        note = f"{comment}；{LEGACY_NOTE}" if comment else LEGACY_NOTE
        if len(set(dates)) > 1:
            extra = "、".join(dates[1:])
            note = f"{LEGACY_NOTE}；表格里另有 {extra} 的重复记录"
        submitted = datetime.fromisoformat(cleared_on) if cleared_on else datetime.utcnow()
        if not args.dry_run:
            db.add(
                ClearRecord(
                    user_id=user_id,
                    username=entry["player"],
                    display_name=entry["player"],
                    profile_url="",
                    map_id=map_id,
                    video_url=video_url,
                    note=note,
                    cleared_on=cleared_on,
                    is_fc=entry["fc"],
                    status=STATUS_APPROVED,
                    submitted_at=submitted,
                    reviewed_at=submitted,
                    reviewed_by="表格导入",
                )
            )
        created_records += 1

    if args.dry_run:
        db.rollback()
    else:
        db.commit()
    db.close()

    print(
        f"地图：新增 {created_maps}，更新 {updated_maps}（其中补上特殊规则 {filled_descriptions}），"
        f"详细记录补建 {missing_maps}（排行表共 {len(seed['maps'])} 张）"
    )
    print(
        f"历史炼金记录：写入 {created_records}，跳过（已存在）{skipped_records}（其中补上视频链接 {filled_videos}、"
        f"补上 FC 标记 {filled_fc}、补上批注 {filled_notes}），"
        f"涉及玩家 {len(players)} 人；表格原始记录 {len(seed['completions'])} 条"
    )
    if args.dry_run:
        print("（--dry-run，未写库）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
