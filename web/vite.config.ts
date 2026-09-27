import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// CI（.github/workflows/deploy.yml）用 `pnpm build`（production）产出带 /gb/ 前缀的 dist 后 rsync 到服务器 ~/gbh/web/dist
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // 生产挂在 https://dl.ballance.top/gb/ 下，资源与 API 前缀都要带上；开发仍用根路径
  base: mode === "production" ? "/gb/" : "/",
  server: {
    port: 5173,
    proxy: {
      // 开发时把 /api 转发到 FastAPI（后端路由本身带 /api 前缀，无需 rewrite）
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      }
    }
  },
  build: {
    target: "es2022",
    outDir: "dist"
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
}));
