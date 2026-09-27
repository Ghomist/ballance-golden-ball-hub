import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import DifficultyBadge from "@/components/DifficultyBadge";
import RecordList from "@/components/RecordList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/api";
import { useAuthStore } from "@/stores/auth";
import type { PlayerDetail } from "@/types";

export default function PlayerView() {
  const { userId } = useParams();
  const me = useAuthStore((state) => state.user);
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setPlayer(await api.players.get(userId));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "加载失败");
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>;
  }

  if (!player) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="font-medium">找不到该玩家</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/players">
            <ArrowLeft className="size-4" />
            返回玩家榜
          </Link>
        </Button>
      </div>
    );
  }

  const isMe = me?.user_id === player.user_id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-5 py-6">
          <Avatar className="size-16">
            <AvatarImage src={player.avatar_url} alt={player.display_name} />
            <AvatarFallback className="text-xl">
              {player.display_name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-40 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{player.display_name}</h1>
              {player.banned && (
                <span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                  已封禁
                </span>
              )}
              {isMe && <span className="text-xs text-muted-foreground">（这是你）</span>}
            </div>
            <p className="text-sm text-muted-foreground">@{player.username}</p>
            {player.profile_url && (
              <a
                href={player.profile_url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                论坛主页
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          <div className="flex gap-6">
            <div>
              <p className="text-xs text-muted-foreground">炼金成功</p>
              <p className="text-2xl font-semibold tabular-nums">{player.clear_count}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">最高难度</p>
              <div className="mt-1">
                {player.top_difficulty_level >= 0 ? (
                  <DifficultyBadge
                    level={player.top_difficulty_level}
                    label={player.top_difficulty_label}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">暂无</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          {isMe ? "我的炼金记录" : "炼金记录"}（{player.records.length}）
        </h2>
        <div className="mt-3">
          <RecordList
            records={player.records}
            showUser={false}
            sortable
            defaultSort="difficulty_desc"
            timeline
            medals={false}
            deletable={() => isMe || Boolean(me?.is_admin)}
            onChanged={load}
            emptyHint="还没有提交过炼金成果"
          />
        </div>
      </section>
    </div>
  );
}
