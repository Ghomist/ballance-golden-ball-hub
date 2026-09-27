import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  Layers,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  Users
} from "lucide-react";
import { toast } from "sonner";

import DifficultyBadge from "@/components/DifficultyBadge";
import EmptyState from "@/components/EmptyState";
import MapFormDialog from "@/components/MapFormDialog";
import RecordList from "@/components/RecordList";
import UserChip from "@/components/UserChip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/api";
import { useAuthStore } from "@/stores/auth";
import type { AdminOverview, ClearRecord, MapItem, Player } from "@/types";

export default function AdminView() {
  const { user, ready, login } = useAuthStore();

  if (!ready) {
    return <p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">审核台需要登录</h1>
        <Button className="mt-4" onClick={login}>
          登录 Ballance 论坛
        </Button>
      </div>
    );
  }

  if (!user.is_admin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <ShieldAlert className="mx-auto size-8 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">你没有管理员权限</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理员由论坛用户名白名单决定（后端 .env 的 <code>ADMIN_USERNAMES</code>），如需权限请联系站长。
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">返回榜单</Link>
        </Button>
      </div>
    );
  }

  return <AdminPanel />;
}

function AdminPanel() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await api.admin.overview());
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "概览加载失败");
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">审核台</h1>
      <p className="text-sm text-muted-foreground">审核玩家的炼金证明、维护地图库与玩家状态</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OverviewCard label="待审核" value={overview?.pending} highlight />
        <OverviewCard label="已通过" value={overview?.approved} />
        <OverviewCard label="已驳回" value={overview?.rejected} />
        <OverviewCard label="地图 / 玩家" value={overview ? `${overview.maps} / ${overview.users}` : undefined} />
      </div>

      <Tabs defaultValue="pending" className="mt-8">
        <TabsList>
          <TabsTrigger value="pending">
            <ClipboardCheck className="size-4" />
            待审核
          </TabsTrigger>
          <TabsTrigger value="maps">
            <Layers className="size-4" />
            地图管理
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="size-4" />
            玩家管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <PendingTab onChanged={loadOverview} />
        </TabsContent>
        <TabsContent value="maps" className="mt-4">
          <MapsTab onChanged={loadOverview} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  highlight
}: {
  label: string;
  value?: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        highlight ? "border-amber-500/40 bg-amber-500/10" : "border-border"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  );
}

function PendingTab({ onChanged }: { onChanged: () => void }) {
  const [records, setRecords] = useState<ClearRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.pending({ limit: 200 });
      setRecords(data.items);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "待审列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    void load();
    onChanged();
  };

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">共 {records.length} 条待审核记录（旧提交在前）</p>
      {records.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="没有待审核的记录"
          description="玩家提交新的炼金成果后会出现在这里。"
        />
      ) : (
        <RecordList records={records} reviewable sortable timeline medals={false} onChanged={refresh} />
      )}
    </>
  );
}

function MapsTab({ onChanged }: { onChanged: () => void }) {
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MapItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.maps.list({ limit: 200, sort: "difficulty_desc" });
      setMaps(data.items);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "地图加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(map: MapItem) {
    if (!window.confirm(`删除「${map.name}」会连带删除其全部炼金记录，确定吗？`)) return;
    try {
      await api.maps.remove(map.id);
      toast.success("已删除");
      void load();
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "删除失败");
    }
  }

  async function submitBulk() {
    setBulkSaving(true);
    try {
      const result = await api.maps.bulk(bulkText);
      toast.success(`导入完成：新增 ${result.created}，更新 ${result.updated}`, {
        description: result.skipped.length ? `跳过 ${result.skipped.length} 行：${result.skipped.slice(0, 3).join("；")}` : undefined
      });
      setBulkOpen(false);
      setBulkText("");
      void load();
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "导入失败");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          新增地图
        </Button>
        <Button variant="outline" onClick={() => setBulkOpen(true)}>
          <Upload className="size-4" />
          批量导入
        </Button>
        <span className="ml-auto self-center text-sm text-muted-foreground">共 {maps.length} 张</span>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">难度</TableHead>
                <TableHead>地图</TableHead>
                <TableHead className="hidden sm:table-cell">作者</TableHead>
                <TableHead className="text-right">炼金人数</TableHead>
                <TableHead className="w-24 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maps.map((map) => (
                <TableRow key={map.id}>
                  <TableCell>
                    <DifficultyBadge level={map.difficulty_level} label={map.difficulty_label} />
                  </TableCell>
                  <TableCell>
                    <Link to={`/maps/${map.id}`} className="font-medium hover:text-primary hover:underline">
                      {map.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {map.author || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{map.clear_count}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="编辑"
                      onClick={() => {
                        setEditing(map);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="删除" onClick={() => void remove(map)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MapFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        map={editing}
        onSaved={() => {
          void load();
          onChanged();
        }}
      />

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>批量导入地图</DialogTitle>
            <DialogDescription>
              每行一张地图，格式：<code>地图名,作者,难度</code>（难度写 T 编号，如 5 表示 T5、21 表示 T20+）。
              同名地图会更新作者与难度；以 # 开头的行会被忽略。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="bulk-text">地图数据</Label>
            <Textarea
              id="bulk-text"
              rows={8}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={"My Hard Map,author,15\nAnother Map,,21"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>
              取消
            </Button>
            <Button onClick={() => void submitBulk()} disabled={bulkSaving || !bulkText.trim()}>
              {bulkSaving && <Loader2 className="size-4 animate-spin" />}
              开始导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UsersTab() {
  const me = useAuthStore((state) => state.user);
  const [players, setPlayers] = useState<Player[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.admin.users({ q: keyword, limit: 200 });
      setPlayers(data.items);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "玩家列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleBan(player: Player) {
    setBusyId(player.user_id);
    try {
      await api.admin.ban(player.user_id, !player.banned);
      toast.success(player.banned ? "已解封" : "已封禁");
      void load();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索用户名 / 昵称"
          className="max-w-64"
        />
        <span className="ml-auto text-sm text-muted-foreground">共 {players.length} 位</span>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
      ) : players.length === 0 ? (
        <EmptyState icon={Users} title="没有找到玩家" description="只有登录并提交过记录的玩家才会出现在这里。" />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>玩家</TableHead>
                <TableHead className="text-right">炼金数</TableHead>
                <TableHead className="hidden text-right sm:table-cell">最高难度</TableHead>
                <TableHead className="text-right">状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player) => (
                <TableRow key={player.user_id}>
                  <TableCell>
                    <UserChip player={player} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{player.clear_count}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {player.top_difficulty_level >= 0 ? (
                      <DifficultyBadge
                        level={player.top_difficulty_level}
                        label={player.top_difficulty_label}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {player.user_id === me?.user_id ? (
                      <span className="text-xs text-muted-foreground">我自己</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={player.banned ? "outline" : "destructive"}
                        disabled={busyId === player.user_id}
                        onClick={() => void toggleBan(player)}
                      >
                        {player.banned ? "解封" : "封禁"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
