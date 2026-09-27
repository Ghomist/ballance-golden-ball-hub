import { create } from "zustand";

import { api, AUTH_BASE } from "@/api";
import type { UserInfo } from "@/types";

interface AuthState {
  user: UserInfo | null;
  /** 首次拉取 /auth/me 是否已完成，避免未登录用户看到闪烁的登录按钮 */
  ready: boolean;
  loading: boolean;
  fetchMe: () => Promise<void>;
  login: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  loading: false,

  fetchMe: async () => {
    set({ loading: true });
    try {
      const user = await api.auth.me();
      set({ user, ready: true, loading: false });
    } catch {
      set({ user: null, ready: true, loading: false });
    }
  },

  login: () => {
    window.location.href = api.auth.loginUrl();
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } finally {
      set({ user: null });
    }
  }
}));

export { AUTH_BASE };
