import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, Layers, Trophy, Upload, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import DifficultyBadge from "@/components/DifficultyBadge";
import EmptyState from "@/components/EmptyState";
import RecordList from "@/components/RecordList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/api";
import { useAuthStore } from "@/stores/auth";
import type { ClearRecord, Stats, TierTimeline } from "@/types";

/** 「按提交时间」模式一页多少条 */
const PAGE = 30;

type Mode = "time" | "tier";

export default function LeaderboardView() {
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const [mode, setMode] = useState<Mode>("tier");
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<ClearRecord[]>([]);
  const [recordTotal, setRecordTotal] = useState(0);
  const [tiers, setTiers] = useState<TierTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [siteStats, timeline, tierData] = await Promise.all([
          api.stats(),
          api.records.list({ limit: PAGE }),
          api.records.byTier(3)
        ]);
        if (!alive) return;
        setStats(siteStats);
        setRecords(timeline.items);
        setRecordTotal(timeline.total);
        setTiers(tierData.tiers);
      } catch (error) {
        if (alive) toast.error(error instanceof ApiError ? error.message : "首页数据加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function loadMore() {
    setMoreLoading(true);
    try {
      const data = await api.records.list({ skip: records.length, limit: PAGE });
      setRecords((prev) => [...prev, ...data.items]);
      setRecordTotal(data.total);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "加载失败");
    } finally {
      setMoreLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section className="rounded-xl border border-border bg-gradient-to-br from-amber-50 to-background px-6 py-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Ballance 炼金成果站</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          按地图难度 T0 → T20+ 收录每一位玩家成功炼金（通关）的视频证明。上传你的视频链接，
          经管理员审核后即可在这里留下名字。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link to="/submit">
              <Upload className="size-4" />
              提交我的炼金成果
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/maps">
              <Layers className="size-4" />
              浏览地图库
            </Link>
          </Button>
          {!user && (
            <Button variant="ghost" onClick={login}>
              登录 Ballance 论坛
            </Button>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Layers} label="收录地图" value={stats?.maps} />
          <StatCard icon={Trophy} label="已通过炼金" value={stats?.records_approved} />
          <StatCard icon={Users} label="参与玩家" value={stats?.players} />
          <StatCard icon={Clock3} label="待审核" value={stats?.records_pending} />
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">最新炼金记录</h2>
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList>
            <TabsTrigger value="tier">按难度分组</TabsTrigger>
            <TabsTrigger value="time">按提交时间</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
      ) : mode === "time" ? (
        records.length === 0 ? (
          <EmptyState
            icon={Trophy}
            className="mt-4"
            title="还没有已通过审核的炼金记录"
            description="成为第一个上榜的玩家吧 —— 提交你的通关视频，管理员审核通过后就会出现在这里。"
          />
        ) : (
          <div className="mt-4">
            <RecordList
              records={records}
              timeline
              medals={false}
              showMap
              defaultSort="date_desc"
              emptyHint="还没有已通过审核的炼金记录"
            />
            {records.length < recordTotal && (
              <div className="mt-4 text-center">
                <Button variant="outline" disabled={moreLoading} onClick={() => void loadMore()}>
                  {moreLoading ? "加载中…" : `加载更多（共 ${recordTotal} 条）`}
                </Button>
              </div>
            )}
          </div>
        )
      ) : tiers.length === 0 ? (
        <EmptyState
          icon={Trophy}
          className="mt-4"
          title="还没有已通过审核的炼金记录"
          description="成为第一个上榜的玩家吧 —— 提交你的通关视频，管理员审核通过后就会出现在这里。"
        />
      ) : (
        <div className="mt-4 space-y-6">
          {tiers.map((tier) => (
            <section key={tier.label}>
              <div className="flex flex-wrap items-center gap-3">
                <DifficultyBadge level={tier.min_level} label={tier.label} className="text-sm" />
                <span className="text-sm text-muted-foreground">
                  {tier.clear_count} 条炼金记录 · {tier.map_count} 张地图
                </span>
                <Button asChild variant="ghost" size="sm" className="ml-auto">
                  <Link to={`/maps?tier=${encodeURIComponent(tier.label)}`}>
                    <Layers className="size-3.5" />
                    查看本档地图
                  </Link>
                </Button>
              </div>
              {tier.level === null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  这些地图还没有人一命通关，因此暂时无法评档；等有人炼金成功后会被归入相应的 T 档。
                </p>
              )}
              <div className="mt-2">
                <RecordList
                  records={tier.records}
                  timeline
                  medals={false}
                  showMap
                  defaultSort="date_desc"
                  emptyHint="本档暂无记录"
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 px-4 py-3 text-left">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  );
}
