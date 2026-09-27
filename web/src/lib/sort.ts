import type { ClearRecord, Player } from "@/types";

/** 炼金记录列表的排序方式 */
export type RecordSortKey = "date_desc" | "date_asc" | "difficulty_desc" | "difficulty_asc";

export const RECORD_SORT_OPTIONS: { value: RecordSortKey; label: string }[] = [
  { value: "date_desc", label: "通关时间：新 → 旧" },
  { value: "date_asc", label: "通关时间：旧 → 新" },
  { value: "difficulty_desc", label: "难度：高 → 低" },
  { value: "difficulty_asc", label: "难度：低 → 高" }
];

/** 地图详情页只按时间排（同一张图最早的记录就是金，所以默认旧→新在最上） */
export const DATE_SORT_OPTIONS: { value: RecordSortKey; label: string }[] = [
  { value: "date_asc", label: "通关时间：旧 → 新" },
  { value: "date_desc", label: "通关时间：新 → 旧" }
];

/** 没填通关日期时退回提交日期 */
export function recordTime(record: ClearRecord) {
  return record.cleared_on || record.submitted_at;
}

/** 难度的「暂无定义」（level 为空）不计入阶梯，两个方向都排在最后 */
function byDifficulty(a: ClearRecord, b: ClearRecord, desc: boolean) {
  const aEmpty = a.map_difficulty_level == null;
  const bEmpty = b.map_difficulty_level == null;
  if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
  const diff = (b.map_difficulty_level ?? 0) - (a.map_difficulty_level ?? 0);
  return desc ? diff : -diff;
}

function byTime(a: ClearRecord, b: ClearRecord, desc: boolean) {
  const diff = recordTime(a).localeCompare(recordTime(b));
  return desc ? -diff : diff;
}

/**
 * 排序：主维度由用户选，另一维度做次级排序、固定用默认方向（难度高→低、时间新→旧）。
 */
export function sortRecords(records: ClearRecord[], key: RecordSortKey) {
  const difficultyFirst = key === "difficulty_desc" || key === "difficulty_asc";
  return [...records].sort((a, b) => {
    const primary = difficultyFirst
      ? byDifficulty(a, b, key === "difficulty_desc")
      : byTime(a, b, key === "date_desc");
    if (primary !== 0) return primary;
    // 次级：难度主排时按时间新→旧，时间主排时按难度高→低
    return difficultyFirst ? byTime(a, b, true) : byDifficulty(a, b, true);
  });
}

/** 榜单里「谁通关了这张图」的排序方式 */
export type PlayerSortKey = "latest_desc" | "latest_asc";

export const PLAYER_SORT_OPTIONS: { value: PlayerSortKey; label: string }[] = [
  { value: "latest_desc", label: "炼金者：最近通关在前" },
  { value: "latest_asc", label: "炼金者：最早通关在前" }
];

export function sortPlayers(players: Player[], key: PlayerSortKey) {
  return [...players].sort((a, b) => {
    const diff = (a.latest_at ?? "").localeCompare(b.latest_at ?? "");
    return key === "latest_desc" ? -diff : diff;
  });
}
