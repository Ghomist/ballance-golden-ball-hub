export interface UserInfo {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  profile_url: string;
  is_admin: boolean;
}

export interface MapItem {
  id: number;
  name: string;
  author: string;
  /** null = 暂无定义（还没人一命通关，无法评档） */
  difficulty_level: number | null;
  difficulty_label: string;
  description: string;
  download_url: string;
  cover_url: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  clear_count: number;
  overflow: boolean;
}

export interface MapListResponse {
  total: number;
  items: MapItem[];
}

export interface DifficultyTier {
  label: string;
  /** 「暂无定义」档为 null */
  min_level: number | null;
  levels: number[];
  maps: number;
}

export interface DifficultyListResponse {
  top_tier: number;
  tiers: DifficultyTier[];
}

export type RecordStatus = "pending" | "approved" | "rejected";

export interface ClearRecord {
  id: number;
  map_id: number;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  profile_url: string;
  video_url: string;
  video_platform: string;
  note: string;
  cleared_on: string;
  /** FC 金：社区里那种特殊金（表格里给玩家格填色的记录） */
  is_fc: boolean;
  status: RecordStatus;
  reject_reason: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string;
  map_name?: string;
  map_author?: string;
  map_difficulty_level?: number | null;
  map_difficulty_label?: string;
}

export interface RecordListResponse {
  total: number;
  items: ClearRecord[];
}

export interface Player {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  profile_url: string;
  clear_count: number;
  fc_count: number;
  top_difficulty_level: number;
  top_difficulty_label: string;
  latest_at: string | null;
  banned: boolean;
}

export interface PlayerDetail extends Player {
  records: ClearRecord[];
}

export interface PlayerListResponse {
  total: number;
  items: Player[];
}

export interface LeaderboardMap {
  id: number;
  name: string;
  author: string;
  difficulty_level: number | null;
  difficulty_label: string;
  clear_count: number;
  cleared_by: Player[];
}

export interface LeaderboardTier {
  label: string;
  /** 「暂无定义」档为 null */
  level: number | null;
  min_level: number | null;
  maps: LeaderboardMap[];
}

export interface LeaderboardResponse {
  tiers: LeaderboardTier[];
}

/** 首页「按难度分组」模式：每档最近 N 条记录（跨该档所有地图） */
export interface TierTimeline {
  label: string;
  /** 「暂无定义」档为 null */
  level: number | null;
  min_level: number | null;
  map_count: number;
  clear_count: number;
  records: ClearRecord[];
}

export interface TierTimelineResponse {
  tiers: TierTimeline[];
}

export interface Stats {
  maps: number;
  records_approved: number;
  records_pending: number;
  players: number;
}

export interface AdminOverview {
  pending: number;
  approved: number;
  rejected: number;
  maps: number;
  users: number;
}
