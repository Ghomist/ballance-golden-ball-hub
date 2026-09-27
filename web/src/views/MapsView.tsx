import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layers, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import DifficultyBadge, { difficultyColor } from "@/components/DifficultyBadge";
import EmptyState from "@/components/EmptyState";
import MapFormDialog from "@/components/MapFormDialog";
import OptionTabs from "@/components/OptionTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { api, ApiError } from "@/api";
import { useAuthStore } from "@/stores/auth";
import type { DifficultyListResponse, MapItem } from "@/types";

const SORTS = [
  { value: "difficulty_desc", label: "难度从高到低" },
  { value: "difficulty_asc", label: "难度从低到高" },
  { value: "clears", label: "炼金人数最多" },
  { value: "name", label: "按名称" },
  { value: "newest", label: "最新收录" }
];

export default function MapsView() {
  const user = useAuthStore((state) => state.user);
  // 支持从首页「查看本档地图」带 ?tier=T16 直接进来
  const [params] = useSearchParams();
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [tiers, setTiers] = useState<DifficultyListResponse | null>(null);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [tier, setTier] = useState(params.get("tier") ?? "");
  const [sort, setSort] = useState("difficulty_desc");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MapItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, difficulty] = await Promise.all([
        api.maps.list({ q: keyword, tier, sort, limit: 200 }),
        api.maps.difficulties()
      ]);
      setMaps(list.items);
      setTotal(list.total);
      setTiers(difficulty);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "地图加载失败");
    } finally {
      setLoading(false);
    }
  }, [keyword, tier, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(map: MapItem) {
    if (!window.confirm(`删除地图「${map.name}」会把它的炼金记录一起删掉，确定吗？`)) return;
    try {
      await api.maps.remove(map.id);
      toast.success("地图已删除");
      void load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "删除失败");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">地图库</h1>
          <p className="text-sm text-muted-foreground">
            共 {total} 张地图 · 难度从 T0 到 T20+，T20+ 表示已突破 T20 的超难图
          </p>
        </div>
        {user?.is_admin && (
          <Button
            className="ml-auto"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            新增地图
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索地图名或作者"
            className="pl-8"
          />
        </div>

        <Select value={tier || "all"} onValueChange={(value) => setTier(value === "all" ? "" : value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部难度" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">全部难度</SelectItem>
            {(tiers?.tiers ?? [])
              .slice()
              .reverse()
              .map((item) => (
                <SelectItem key={item.label} value={item.label}>
                  {item.label}（{item.maps} 张）
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <OptionTabs value={sort} onChange={setSort} options={SORTS} label="地图排序方式" />
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      ) : maps.length === 0 ? (
        <EmptyState
          icon={Layers}
          className="mt-6"
          title="没有找到地图"
          description="换个关键词或难度筛选条件试试；如果是新地图，可以请管理员收录。"
        />
      ) : (
        <div className="mt-6 rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-2 p-0" />
                <TableHead>地图</TableHead>
                <TableHead className="hidden sm:table-cell">作者</TableHead>
                <TableHead className="text-right">炼金人数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maps.map((map) => (
                <TableRow key={map.id} className="relative">
                  <TableCell className="w-2 p-0">
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-2"
                      style={{ backgroundColor: difficultyColor(map.difficulty_level) }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DifficultyBadge level={map.difficulty_level} label={map.difficulty_label} />
                      <Link
                        to={`/maps/${map.id}`}
                        className="truncate font-medium transition hover:text-primary hover:underline"
                      >
                        {map.name}
                      </Link>
                    </div>
                    {map.description && (
                      <p
                        className="mt-1 line-clamp-1 text-xs text-muted-foreground"
                        title={map.description}
                      >
                        {map.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {map.author || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{map.clear_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="secondary">
                        <Link to={`/maps/${map.id}`}>查看详情</Link>
                      </Button>
                      {map.download_url && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={map.download_url} target="_blank" rel="noreferrer noopener">
                            下载地图
                          </a>
                        </Button>
                      )}
                      {user?.is_admin && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="编辑"
                            onClick={() => {
                              setEditing(map);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="删除"
                            onClick={() => void remove(map)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {loading && maps.length > 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> 刷新中
        </p>
      )}

      <MapFormDialog open={dialogOpen} onOpenChange={setDialogOpen} map={editing} onSaved={load} />
    </div>
  );
}
