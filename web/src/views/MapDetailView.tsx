import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, Trophy, Upload } from "lucide-react";
import { toast } from "sonner";

import DifficultyBadge from "@/components/DifficultyBadge";
import OptionTabs from "@/components/OptionTabs";
import RecordList, { FC_NAME_CLASS } from "@/components/RecordList";
import SubmitDialog from "@/components/SubmitDialog";
import UserChip from "@/components/UserChip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/api";
import { DATE_SORT_OPTIONS } from "@/lib/sort";
import { useAuthStore } from "@/stores/auth";
import type { ClearRecord, MapItem } from "@/types";

export default function MapDetailView() {
  const { mapId } = useParams();
  const id = Number(mapId);
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);

  const [map, setMap] = useState<MapItem | null>(null);
  const [records, setRecords] = useState<ClearRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fcOnly, setFcOnly] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return;
    setLoading(true);
    try {
      const [mapData, recordList] = await Promise.all([
        api.maps.get(id),
        api.records.list({ map_id: id, limit: 200 })
      ]);
      setMap(mapData);
      setRecords(recordList.items);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "加载失败");
      setMap(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const approved = records.filter((record) => record.status === "approved");
  const fcRecords = approved.filter((record) => record.is_fc);
  const shown = fcOnly ? fcRecords : records;
  const myRecord = user ? records.find((record) => record.user_id === user.user_id) : undefined;

  if (loading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  if (!map) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="font-medium">地图不存在或已被删除</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/maps">
            <ArrowLeft className="size-4" />
            返回地图库
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/maps">
          <ArrowLeft className="size-4" />
          地图库
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <DifficultyBadge level={map.difficulty_level} label={map.difficulty_label} className="text-sm" />
            <h1 className="text-2xl font-bold">{map.name}</h1>
            {map.overflow && (
              <span className="text-xs text-muted-foreground">（已超出 T20 上限）</span>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {map.author ? `作者：${map.author} · ` : ""}
            {map.clear_count} 人炼金成功
            {map.download_url ? "" : " · 暂无下载链接"}
          </p>

          {map.description && (
            <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm">
              <span className="mr-2 font-medium text-amber-400">特殊规则</span>
              {map.description}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {user ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Upload className="size-4" />
                {myRecord ? "更新我的炼金链接" : "提交我的炼金成果"}
              </Button>
            ) : (
              <Button onClick={login}>登录后提交</Button>
            )}
            {map.download_url && (
              <Button asChild variant="outline">
                <a href={map.download_url} target="_blank" rel="noreferrer noopener">
                  <Download className="size-4" />
                  下载地图
                </a>
              </Button>
            )}
          </div>

          {myRecord && (
            <p className="text-xs text-muted-foreground">
              你提交的链接：{" "}
              <a
                href={myRecord.video_url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {myRecord.video_url.slice(0, 48)}
                <ExternalLink className="size-3" />
              </a>{" "}
              （{myRecord.status === "pending" ? "待审核" : myRecord.status === "approved" ? "已通过" : "已驳回"}）
            </p>
          )}
        </CardContent>
      </Card>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Trophy className="size-4" />
          炼金成功的玩家（{approved.length}）
        </h2>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {approved.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有人通过审核的炼金记录，来当第一个吧。</p>
          ) : (
            approved.map((record) => (
              <UserChip
                key={record.id}
                player={record}
                className={record.is_fc ? FC_NAME_CLASS : undefined}
              />
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">炼金记录时间轴</h2>
          <OptionTabs
            value={fcOnly ? "fc" : "all"}
            onChange={(next) => setFcOnly(next === "fc")}
            label="炼金记录筛选"
            options={[
              { value: "all", label: `全部（${approved.length}）` },
              { value: "fc", label: `仅看 FC（${fcRecords.length}）` }
            ]}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          按通关时间先后排列（没填日期的按提交时间），最早通关的三条标金 / 银 / 铜；
          也可以切到「新 → 旧」倒序看最新的记录。
        </p>
        <div className="mt-3">
          <RecordList
            records={shown}
            showMap={false}
            timeline
            sortable
            sortOptions={DATE_SORT_OPTIONS}
            defaultSort="date_asc"
            deletable={(record) =>
              record.user_id === user?.user_id || Boolean(user?.is_admin)
            }
            onChanged={load}
            emptyHint={
              fcOnly ? "这张图还没有 FC 金记录" : "还没有人提交这张地图的炼金记录"
            }
          />
        </div>
      </section>

      <SubmitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        maps={[map]}
        defaultMapId={map.id}
        onSubmitted={load}
      />
    </div>
  );
}
