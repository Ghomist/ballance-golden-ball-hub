import type {
  AdminOverview,
  ClearRecord,
  DifficultyListResponse,
  LeaderboardResponse,
  MapItem,
  MapListResponse,
  Player,
  PlayerDetail,
  PlayerListResponse,
  RecordListResponse,
  RecordStatus,
  Stats,
  TierTimelineResponse,
  UserInfo
} from "@/types";

/** 生产环境前后端同源，统一走 /api 前缀；开发环境由 vite 代理到 127.0.0.1:8000。
 *  生产被部署在子路径下（https://dl.ballance.top/gb/），所以前缀由 vite 的 base 推导 */
const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

/** 登录是整页跳转，开发时必须直达后端，否则 OAuth 回调地址会落在 dev server 上 */
export const AUTH_BASE = import.meta.env.DEV ? "http://127.0.0.1:8000/api" : BASE;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    let message = `请求失败（HTTP ${response.status}）`;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data?.detail === "string") message = data.detail;
      else if (Array.isArray(data?.detail) && data.detail[0]?.msg) message = String(data.detail[0].msg);
    } catch {
      /* 忽略解析失败，保留默认文案 */
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface MapQuery {
  [key: string]: QueryValue;
  q?: string;
  tier?: string;
  sort?: string;
  skip?: number;
  limit?: number;
}

export interface RecordQuery {
  [key: string]: QueryValue;
  map_id?: number;
  user_id?: string;
  status?: RecordStatus;
  fc_only?: boolean;
  skip?: number;
  limit?: number;
}

export const api = {
  auth: {
    me: () => request<UserInfo | null>("/auth/me"),
    loginUrl: () => `${AUTH_BASE}/auth/login`,
    logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" })
  },

  stats: () => request<Stats>("/stats"),

  maps: {
    list: (query: MapQuery = {}) => request<MapListResponse>("/maps", { query }),
    get: (id: number) => request<MapItem>(`/maps/${id}`),
    difficulties: () => request<DifficultyListResponse>("/maps/difficulties"),
    create: (body: MapPayload) => request<MapItem>("/maps", { method: "POST", body }),
    update: (id: number, body: MapPayload) => request<MapItem>(`/maps/${id}`, { method: "PUT", body }),
    remove: (id: number) => request<void>(`/maps/${id}`, { method: "DELETE" }),
    bulk: (text: string) =>
      request<{ created: number; updated: number; skipped: string[] }>("/maps/bulk", {
        method: "POST",
        body: { text }
      })
  },

  records: {
    list: (query: RecordQuery = {}) => request<RecordListResponse>("/records", { query }),
    mine: (query: RecordQuery = {}) => request<RecordListResponse>("/records/mine", { query }),
    /** 首页「按难度分组」模式：每档最近 N 条记录 */
    byTier: (perTier = 3) =>
      request<TierTimelineResponse>("/records/by-tier", { query: { per_tier: perTier } }),
    submit: (body: RecordPayload) => request<ClearRecord>("/records", { method: "POST", body }),
    remove: (id: number) => request<void>(`/records/${id}`, { method: "DELETE" })
  },

  leaderboard: (includeEmpty = false) =>
    request<LeaderboardResponse>("/leaderboard", { query: { include_empty: includeEmpty } }),

  players: {
    list: (query: { sort?: string; q?: string; skip?: number; limit?: number } = {}) =>
      request<PlayerListResponse>("/users", { query }),
    get: (userId: string) => request<PlayerDetail>(`/users/${encodeURIComponent(userId)}`)
  },

  admin: {
    overview: () => request<AdminOverview>("/admin/overview"),
    pending: (query: { skip?: number; limit?: number } = {}) =>
      request<RecordListResponse>("/admin/pending", { query }),
    review: (recordId: number, action: "approve" | "reject", reason = "", isFc?: boolean) =>
      request<ClearRecord>(`/records/${recordId}/review`, {
        method: "POST",
        body: { action, reason, is_fc: isFc }
      }),
    users: (query: { q?: string; limit?: number } = {}) => request<PlayerListResponse>("/admin/users", { query }),
    ban: (userId: string, banned: boolean) =>
      request<Player>(`/admin/users/${encodeURIComponent(userId)}/ban`, {
        method: "POST",
        body: { banned }
      })
  }
};

export interface MapPayload {
  name: string;
  author?: string;
  /** null = 暂无定义 */
  difficulty_level?: number | null;
  description?: string;
  download_url?: string;
  cover_url?: string;
}

export interface RecordPayload {
  map_id: number;
  video_url: string;
  note?: string;
  cleared_on?: string;
  /** 声明这是 FC 金 */
  is_fc?: boolean;
}
