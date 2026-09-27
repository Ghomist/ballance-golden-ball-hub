import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AppHeader from "@/components/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/stores/auth";
import AdminView from "@/views/AdminView";
import LeaderboardView from "@/views/LeaderboardView";
import MapDetailView from "@/views/MapDetailView";
import MapsView from "@/views/MapsView";
import NotFoundView from "@/views/NotFoundView";
import PlayerView from "@/views/PlayerView";
import PlayersView from "@/views/PlayersView";
import RulesView from "@/views/RulesView";
import SubmitView from "@/views/SubmitView";

/** 生产部署在子路径下（https://dl.ballance.top/gb/）：路由必须感知 base，
 *  否则 <Link to="/maps"> 会生成 /maps/1 这样的绝对路径，跳到同域的资源站去。
 *  开发环境 BASE_URL 为 "/"，退回根路径。 */
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  const fetchMe = useAuthStore((state) => state.fetchMe);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  return (
    <BrowserRouter basename={BASENAME}>
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LeaderboardView />} />
            <Route path="/maps" element={<MapsView />} />
            <Route path="/maps/:mapId" element={<MapDetailView />} />
            <Route path="/submit" element={<SubmitView />} />
            <Route path="/players" element={<PlayersView />} />
            <Route path="/players/:userId" element={<PlayerView />} />
            <Route path="/rules" element={<RulesView />} />
            <Route path="/admin" element={<AdminView />} />
            <Route path="/leaderboard" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </main>
        <footer className="border-t border-border/60 px-6 py-6 text-center text-xs text-muted-foreground">
          Ballance 炼金成果站 · 数据来自社区玩家提交，经管理员审核后展示
        </footer>
      </div>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}
