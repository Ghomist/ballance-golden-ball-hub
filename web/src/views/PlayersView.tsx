import { useCallback, useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";

import DifficultyBadge from "@/components/DifficultyBadge";
import EmptyState from "@/components/EmptyState";
import UserChip from "@/components/UserChip";
import OptionTabs from "@/components/OptionTabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { api, ApiError } from "@/api";
import type { Player } from "@/types";

const SORTS = [
  { value: "clears", label: "按炼金数" },
  { value: "difficulty", label: "按最高难度" },
  { value: "recent", label: "按最近提交" }
];

export default function PlayersView() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("clears");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.players.list({ sort, q: keyword, limit: 100 });
      setPlayers(data.items);
      setTotal(data.total);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "玩家榜加载失败");
    } finally {
      setLoading(false);
    }
  }, [sort, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">玩家榜</h1>
      <p className="text-sm text-muted-foreground">共 {total} 位玩家提交过炼金成果</p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索玩家"
            className="pl-8"
          />
        </div>
        <OptionTabs value={sort} onChange={setSort} options={SORTS} label="玩家榜排序方式" />
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      ) : players.length === 0 ? (
        <EmptyState icon={Users} className="mt-6" title="没有找到玩家" description="换个关键词试试。" />
      ) : (
        <div className="mt-6 rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>玩家</TableHead>
                <TableHead className="text-right">炼金数</TableHead>
                <TableHead className="text-right">FC 金</TableHead>
                <TableHead className="text-right">最高难度</TableHead>
                <TableHead className="hidden text-right sm:table-cell">最近提交</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((player, index) => (
                <TableRow key={player.user_id}>
                  <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                  <TableCell>
                    <UserChip player={player} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {player.clear_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {player.fc_count > 0 ? (
                      <span className="font-medium text-amber-400">{player.fc_count}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {player.top_difficulty_level >= 0 ? (
                      <DifficultyBadge
                        level={player.top_difficulty_level}
                        label={player.top_difficulty_label}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">暂无</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right text-xs text-muted-foreground sm:table-cell">
                    {player.latest_at ? new Date(player.latest_at).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
