"""从《平衡球地图炼金难度排行.xlsx》生成种子数据 scripts/seed/ranking.json。

只在下一次更新表格时手动跑：

    uv run --with python-calamine python scripts/xlsx_to_seed.py

表格结构（sheet「地图排行」）：
  - 第 2 行是难度标题（T0/T1/.../T22/暂无定义），每档占两列：关卡名 + 作者
  - 第 4 行起是数据；第 28 行起是 FAQ 区块（在左侧两列，需要排除）
sheet「详细记录（完善中...）」：难度 | 关卡名 | 作者 | 完成者：日期 ...
"""

import glob
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from python_calamine import CalamineWorkbook

ROOT = Path(__file__).parent.parent
OUT = Path(__file__).parent / "seed" / "ranking.json"
UNDEFINED = "暂无定义"
DATA_END_ROW = 27  # 第 28 行起是 FAQ，不再算地图数据
DETAIL_SHEET = "详细记录（完善中...）"
R_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def cell(row: list, idx: int) -> str:
    if idx >= len(row) or row[idx] is None:
        return ""
    return str(row[idx]).replace("\t", " ").strip()


def col_letters(idx: int) -> str:
    """0 基列号 → Excel 列名（3 → "D"）。"""
    letters = ""
    idx += 1
    while idx:
        idx, rem = divmod(idx - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def col_number(letters: str) -> int:
    """Excel 列名 → 1 基列号（"B" → 2）。"""
    value = 0
    for ch in letters:
        value = value * 26 + ord(ch) - 64
    return value


def _sheet_path(z: zipfile.ZipFile, sheet_name: str) -> str:
    """用 workbook.xml + 它的 rels 把 sheet 名换成 xl/worksheets/sheetN.xml。"""
    rid_to_path = {
        rel.get("Id"): rel.get("Target").lstrip("/")
        for rel in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    }
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    sheet_rid = next(
        node.get(f"{R_NS}id")
        for node in wb.iter()
        if node.tag.endswith("}sheet") and node.get("name") == sheet_name
    )
    path = rid_to_path[sheet_rid]
    return path if path.startswith("xl/") else f"xl/{path}"


def sheet_start(xlsx: Path, sheet_name: str) -> tuple[int, int]:
    """算出 sheet 里第一个有内容的单元格位置：(1 基行号, 1 基列号)。

    calamine 的 to_python() 会裁掉左上角的空行空列，所以拿到的 [行下标, 列下标]
    要加上这个起点，才是 Excel 里的真实坐标（本表格从 B2 开始 → (2, 2)）。
    """
    with zipfile.ZipFile(xlsx) as z:
        xml = z.read(_sheet_path(z, sheet_name)).decode("utf-8")
    refs = re.findall(r'<c r="([A-Z]+)(\d+)"', xml)
    if not refs:
        return 1, 1
    return min(int(row) for _, row in refs), min(col_number(col) for col, _ in refs)


def sheet_hyperlinks(xlsx: Path, sheet_name: str) -> dict[tuple[int, str], str]:
    """取某个 sheet 上每个单元格的外部超链接：{(行号, Excel 列名): URL}。

    calamine 不暴露超链接，所以直接解 xlsx（就是个 zip）：
    workbook.xml 找到 sheet 的 rId → workbook.xml.rels 找到 sheet 文件 →
    sheet 的同名 .rels 里 rId → 真实 URL，再由 sheet 里的 <hyperlink ref="E4" r:id="rId3"/> 对上单元格。
    """
    with zipfile.ZipFile(xlsx) as z:
        path = _sheet_path(z, sheet_name)
        # sheet 自己的关系文件：xl/worksheets/_rels/sheet2.xml.rels
        folder, filename = path.rsplit("/", 1)
        rels_path = f"{folder}/_rels/{filename}.rels"
        targets: dict[str, str] = {}
        if rels_path in z.namelist():
            for rel in ET.fromstring(z.read(rels_path)):
                if rel.get("TargetMode") == "External":
                    targets[rel.get("Id")] = rel.get("Target")
        links: dict[tuple[int, str], str] = {}
        for node in ET.fromstring(z.read(path)).iter():
            ref, rid = node.get("ref"), node.get(f"{R_NS}id")
            if node.tag.endswith("}hyperlink") and ref and rid and rid in targets:
                col = re.match(r"([A-Z]+)(\d+)", ref)
                if col:
                    links[(int(col.group(2)), col.group(1))] = targets[rid]
        return links


def sheet_fills(xlsx: Path, sheet_name: str) -> set[tuple[int, str]]:
    """取某个 sheet 上「填了底色」的单元格集合：{(行号, Excel 列名)}。

    FC 金就是《详细记录》里给玩家格填了底色的那种通关（社区叫法），calamine 不暴露样式，
    所以解 xlsx：styles.xml 的 <cellXfs> 里每个样式带 fillId，<fills> 里按 fillId 找底色；
    sheet 里 <c r="F16" s="12"> 的 s 就是样式下标，patternType="solid" 才算有底色。
    """
    with zipfile.ZipFile(xlsx) as z:
        styles = z.read("xl/styles.xml").decode("utf-8")
        sheet_path = _sheet_path(z, sheet_name)
        sheet_xml = z.read(sheet_path).decode("utf-8")

    xfs = re.findall(r"<xf\b[^>]*>", styles.split("<cellXfs")[1].split("</cellXfs>")[0])
    # 注意：xf 里的 fillId 是 <fills> 的下标，不是样式下标
    fill_of_style = [
        int(m.group(1)) if (m := re.search(r'fillId="(\d+)"', xf)) else 0 for xf in xfs
    ]
    solid_fill = [
        'patternType="solid"' in fill
        for fill in re.findall(r"<fill>.*?</fill>", styles, re.S)
    ]
    has_fill = [
        solid_fill[fid] if fid < len(solid_fill) else False for fid in fill_of_style
    ]

    filled: set[tuple[int, str]] = set()
    for ref, style in re.findall(r'<c r="([A-Z]+\d+)"(?: s="(\d+)")?', sheet_xml):
        idx = int(style) if style else 0
        if idx < len(has_fill) and has_fill[idx]:
            col, row = re.match(r"([A-Z]+)(\d+)", ref).groups()
            filled.add((int(row), col))
    return filled


def sheet_values(xlsx: Path, sheet_name: str) -> dict[tuple[int, str], str]:
    """取某个 sheet 的单元格文本：{(行号, Excel 列名): 文本}。

    批注的 ref 是 Excel 坐标，而 calamine 的行号遇到空行会与 Excel 行号错位，
    所以定位批注落在哪个单元格时，值也从原始 XML 里取，两边就用同一套坐标。
    """
    with zipfile.ZipFile(xlsx) as z:
        shared = ["".join(si.itertext()) for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        xml = z.read(_sheet_path(z, sheet_name)).decode("utf-8")

    values: dict[tuple[int, str], str] = {}
    for node in ET.fromstring(xml).iter():
        match = re.match(r"([A-Z]+)(\d+)$", node.get("r") or "")
        if not node.tag.endswith("}c") or not match:
            continue
        text = ""
        for child in node:
            if child.tag.endswith("}v") and child.text:
                text = shared[int(child.text)] if node.get("t") == "s" else child.text
                break
        if text:
            values[(int(match.group(2)), match.group(1))] = text
    return values


def sheet_comments(xlsx: Path, sheet_name: str) -> dict[tuple[int, str], str]:
    """取某个 sheet 上的批注（单元格注释）：{(行号, Excel 列名): 文本}。

    地图的「特殊规则」（例：仅允许第八节死一次球）与个别记录的说明都写在单元格批注里，
    calamine 不暴露批注，所以同样解 xlsx：sheet 的 .rels 找到 comments?.xml，再按 ref 对上单元格。
    """
    with zipfile.ZipFile(xlsx) as z:
        path = _sheet_path(z, sheet_name)
        folder, filename = path.rsplit("/", 1)
        rels_path = f"{folder}/_rels/{filename}.rels"
        target = None
        if rels_path in z.namelist():
            for rel in ET.fromstring(z.read(rels_path)):
                if (rel.get("Type") or "").endswith("/comments"):
                    target = rel.get("Target", "").replace("../", "xl/")
        if not target or target not in z.namelist():
            return {}
        tree = ET.fromstring(z.read(target))

    notes: dict[tuple[int, str], str] = {}
    for node in tree.iter():
        match = re.match(r"([A-Z]+)(\d+)$", node.get("ref") or "")
        if not node.tag.endswith("}comment") or not match:
            continue
        text = re.sub(r"\s+", " ", "".join(node.itertext())).strip()
        if text:
            notes[(int(match.group(2)), match.group(1))] = text
    return notes


def norm(name: str) -> str:
    """归一化地图名用于跨 sheet 匹配（括号全半角、空格、大小写差异）。"""
    s = name.strip().replace("（", "(").replace("）", ")").replace("　", "")
    return re.sub(r"\s+", "", s).lower()


def main() -> int:
    # 排除 Excel 打开时生成的 ~$ 临时文件
    files = [f for f in glob.glob(str(ROOT / "*.xlsx")) if not Path(f).name.startswith("~$")]
    if not files:
        print("找不到 xlsx", file=sys.stderr)
        return 1
    wb = CalamineWorkbook.from_path(files[0])

    # ---- 地图排行 ----
    rows = wb.get_sheet_by_name("地图排行").to_python()
    header = rows[1]
    tiers: list[tuple[str, int]] = [
        (cell(header, i), i) for i in range(len(header)) if cell(header, i)
    ]

    maps: list[dict] = []
    seen: set[str] = set()
    for row in rows[3:DATA_END_ROW]:  # 0 基：表格第 4~27 行（第 28 行起是 FAQ）
        for label, col in tiers:
            name, author = cell(row, col), cell(row, col + 1)
            if not name or norm(name) in seen:
                continue
            seen.add(norm(name))
            maps.append(
                {
                    "name": name,
                    "author": author,
                    "difficulty_level": None if label == UNDEFINED else int(label[1:]),
                }
            )
    maps.sort(key=lambda m: (m["difficulty_level"] is None, m["difficulty_level"] or 0))

    xlsx = Path(files[0])

    # ---- 地图的「特殊规则」：排行榜 sheet 上挂在地图名格的批注 ----
    rules: dict[str, str] = {}
    ranking_values = sheet_values(xlsx, "地图排行")
    for (row, col), text in sheet_comments(xlsx, "地图排行").items():
        name = ranking_values.get((row, col), "")
        if name and not re.fullmatch(r"T\d+", name):  # 别把档位标题当成地图名
            rules[norm(name)] = text

    # ---- 详细记录：完成者 + 日期 + 视频链接（单元格超链接） ----
    detail = wb.get_sheet_by_name(DETAIL_SHEET).to_python()
    links = sheet_hyperlinks(xlsx, DETAIL_SHEET)
    filled = sheet_fills(xlsx, DETAIL_SHEET)
    comments = sheet_comments(xlsx, DETAIL_SHEET)
    # calamine 裁掉了左上角的空行空列，下标加上起点才是 Excel 真实坐标
    start_row, start_col = sheet_start(Path(files[0]), DETAIL_SHEET)
    completions: list[dict] = []
    tier = None
    for row_index, row in enumerate(detail):
        if row_index < 2:  # 第 1~2 行是表头/说明
            continue
        label, name, author = cell(row, 0), cell(row, 1), cell(row, 2)
        if label and label.startswith("T") and label[1:].isdigit():
            tier = int(label[1:])
        if not name:
            continue
        # 详细记录里地图名格的批注更完整，覆盖排行榜里的那份
        map_ref = (row_index + start_row, col_letters(start_col))
        if map_ref in comments:
            rules[norm(name)] = comments[map_ref]
        for col in range(3, len(row)):
            raw = cell(row, col)
            if not raw:
                continue
            m = re.match(r"^(.*?)[:：]\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})", raw)
            if not m:
                continue
            # 单元格在 Excel 里的真实坐标：calamine 下标 + sheet 起点
            excel_ref = (row_index + start_row, col_letters(col + start_col - 1))
            completions.append(
                {
                    "map_name": name,
                    "map_author": author,
                    "difficulty_level": tier,
                    "player": m.group(1).strip(),
                    "cleared_on": f"{m.group(2)}-{int(m.group(3)):02d}-{int(m.group(4)):02d}",
                    # 单元格上的超链接就指向该次通关的视频
                    "video_url": links.get(excel_ref, ""),
                    # 玩家格填了底色 = FC 金
                    "is_fc": excel_ref in filled,
                    # 玩家格上的批注 = 这条记录的说明（例如「初始为石球」）
                    "note": comments.get(excel_ref, ""),
                }
            )

    # 地图说明 = 该图的特殊规则（没有的就是空）
    for item in maps:
        item["description"] = rules.get(norm(item["name"]), "")

    # ---- 规则 + FAQ（表头说明行 + 第 28 行起的问答区） ----
    intro = [s.strip() for s in re.split(r"\s{2,}", cell(rows[0], 0)) if s.strip()]
    faq: list[list[str]] = []
    for row in rows[27:]:
        q, a = cell(row, 0), cell(row, 2)
        if q and a and a != "回答":
            faq.append([q, a])

    payload = {
        "source": Path(files[0]).name,
        "maps": maps,
        "completions": completions,
        "rules": {"intro": intro, "faq": faq},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    by_level: dict[str, int] = {}
    for m in maps:
        key = UNDEFINED if m["difficulty_level"] is None else f"T{m['difficulty_level']}"
        by_level[key] = by_level.get(key, 0) + 1
    print(f"写出 {OUT}")
    print(f"地图 {len(maps)} 张：{by_level}")
    print(f"历史通关记录 {len(completions)} 条，覆盖 {len({c['map_name'] for c in completions})} 张地图，"
          f"其中带视频链接 {sum(1 for c in completions if c['video_url'])} 条"
          f"，FC 金 {sum(1 for c in completions if c['is_fc'])} 条"
          f"，带批注 {sum(1 for c in completions if c['note'])} 条")
    known = {norm(m["name"]) for m in maps}
    outside = [k for k in rules if k not in known]
    print(f"地图特殊规则 {len(rules)} 张（{len(outside)} 张不在排行榜里：{'、'.join(outside) if outside else '无'}）")
    print(f"规则 {len(intro)} 条，FAQ {len(faq)} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
