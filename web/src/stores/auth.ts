import { create } from "zustand";

import { api, AUTH_BASE, HUB_AUTH_BASE } from "@/api";
import type { UserInfo } from "@/types";

/** 与下载站共用的存储键：两站同源（/gb/ 是下载站的子路径），
 *  在下载站登录后打开炼金站就已经是登录状态。 */
const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

function loadUser(): UserInfo | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null") as UserInfo | null;
  } catch {
    return null;
  }
}

interface AuthState {
  /** 下载站签发的 JWT（两站共用 JWT_SECRET，所以本地就能校验，不依赖下载站在线） */
  token: string;
  user: UserInfo | null;
  /** 首次拉取 /auth/me 是否已完成，避免未登录用户看到闪烁的登录按钮 */
  ready: boolean;
  loading: boolean;
  setSession: (token: string, user: UserInfo) => void;
  fetchMe: () => Promise<void>;
  login: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: loadUser(),
  ready: false,
  loading: false,

  setSession: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, ready: true, loading: false });
  },

  /** 登录统一走下载站的 /auth/login（论坛 OAuth 由下载站完成），
   *  完成后带着 #token= 跳回炼金站。 */
  login: () => {
    window.location.href = api.auth.loginUrl();
  },

  /** 纯前端登出：token 在 localStorage 里，没有服务端会话要清。
   *  两站共用同一个键，所以这里登出等于两站一起登出。 */
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: "", user: null, ready: true, loading: false });
  },

  // OAuth 回调：下载站 redirect 到 /gb/#token=...，在这里消费掉
  fetchMe: async () => {
    const m = window.location.hash.match(/token=([^&]+)/);
    const token = m ? decodeURIComponent(m[1]) : get().token;
    if (m) history.replaceState(null, "", window.location.pathname + window.location.search);

    if (!token) {
      set({ token: "", user: null, ready: true, loading: false });
      return;
    }

    // 先把 token 落进 store 与 localStorage，随后的 /auth/me 才带得上
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, loading: true });
    try {
      const user = await api.auth.me();
      if (user) get().setSession(token, user);
      else get().logout();
    } catch {
      get().logout();
    }
  }
}));

export { AUTH_BASE, HUB_AUTH_BASE };
