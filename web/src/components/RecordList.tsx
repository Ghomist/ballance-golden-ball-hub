import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import DifficultyBadge from "@/components/DifficultyBadge";
import SortSelect from "@/components/SortSelect";
import StatusBadge from "@/components/StatusBadge";
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
import { api, ApiError } from "@/api";
import {
  RECORD_SORT_OPTIONS,
  recordTime,
  sortRecords,
  type RecordSortKey
} from "@/lib/sort";
import type { ClearRecord } from "@/types";

interface RecordListProps {
  records: ClearRecord[];
  /** 是否显示所属地图（地图详情页里不需要） */
  showMap?: boolean;
  /** 是否显示提交者（个人主页里不需要） */
  showUser?: boolean;
  /** 管理员视图：显示通过 / 驳回 */
  reviewable?: boolean;
  /** 显示删除按钮（本人或管理员） */
  deletable?: boolean | ((record: ClearRecord) => boolean);
  /** 显示排序选择器（玩家主页 / 我的记录 / 地图详情页都会开） */
  sortable?: boolean;
  /** 排序选择器的默认值（不传：时间轴默认旧→新，否则新→旧） */
  defaultSort?: RecordSortKey;
  /** 时间轴模式（地图详情页 / 个人主页 / 我的记录）：按时间先后排列，左侧日期 + 圆点 */
  timeline?: boolean;
  /** 时间轴的前三条要不要填金银铜（审核台这种“前三”没意义的列表关掉） */
  medals?: boolean;
  /** 排序选择器里给哪些选项（默认四种；地图详情页只给时间两种） */
  sortOptions?: { value: RecordSortKey; label: string }[];
  onChanged?: () => void;
  emptyHint?: string;
}

function platformLabel(record: ClearRecord) {
  return record.video_platform || "视频";
}

/** 时间轴前三条的金银铜点色（最早通关在最上）；银色用浅灰而不是纯白，不然看不太出 */
const MEDALS = [
  { dot: "bg-amber-400 ring-amber-400/30" },
  { dot: "bg-zinc-400 ring-zinc-400/30" },
  { dot: "bg-amber-700 ring-amber-700/30" }
];

/** FC 金：把玩家名字标成金色，用与时间轴金点同一个金（amber-400） */
export const FC_NAME_CLASS = "font-medium text-amber-400";

export default function RecordList({
  records,
  showMap = true,
  showUser = true,
  reviewable = false,
  sortable = false,
  defaultSort,
  timeline = false,
  medals = true,
  sortOptions = RECORD_SORT_OPTIONS,
  deletable = false,
  onChanged,
  emptyHint = "还没有炼金记录"
}: RecordListProps) {
  const [rejecting, setRejecting] = useState<ClearRecord | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<RecordSortKey>(
    defaultSort ?? (timeline ? "date_asc" : "date_desc")
  );

  const sorted = useMemo(() => sortRecords(records, sortKey), [records, sortKey]);

  /** 时间轴上最早的 3 条金银铜：按时间而不是显示顺序算，换排序后不会跑位 */
  const medalDots = useMemo(() => {
    if (!timeline || !medals) return new Map<number, string>();
    const byTime = [...records].sort((a, b) => recordTime(a).localeCompare(recordTime(b)));
    return new Map(
      byTime.slice(0, MEDALS.length).map((item, rank) => [item.id, MEDALS[rank].dot])
    );
  }, [records, timeline, medals]);

  async function review(
    record: ClearRecord,
    action: "approve" | "reject",
    rejectReason = "",
    isFc?: boolean
  ) {
    setBusyId(record.id);
    try {
      await api.admin.review(record.id, action, rejectReason, isFc);
      toast.success(action === "approve" ? "已通过审核" : "已驳回");
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(record: ClearRecord) {
    if (!window.confirm("确定删除这条炼金记录吗？")) return;
    setBusyId(record.id);
    try {
      await api.records.remove(record.id);
      toast.success("已删除");
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  }

  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyHint}
      </p>
    );
  }

  return (
    <>
      {sortable && records.length > 0 && (
        <div className="mb-3 flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground">共 {records.length} 条</span>
          <SortSelect
            value={sortKey}
            onChange={setSortKey}
            options={sortOptions}
            label="炼金记录排序方式"
          />
        </div>
      )}
      <ul
        className={
          timeline ? "" : "divide-y divide-border rounded-lg border border-border"
        }
      >
        {sorted.map((record) => {
          return (
            <li
              key={record.id}
              className={timeline ? "grid grid-cols-[auto_1fr] items-stretch" : "px-4 py-3"}
            >
              {timeline && (
                <div className="flex items-stretch justify-end gap-2 pr-3">
                  <span className="flex items-center text-xs tabular-nums text-muted-foreground">
                    {recordTime(record).slice(0, 10)}
                  </span>
                  <span className="relative flex w-2.5 items-center justify-center">
                    <span aria-hidden className="absolute inset-y-0 w-px bg-border" />
                    <span
                      className={`relative z-10 size-2.5 rounded-full ring-4 ${
                        medalDots.get(record.id) ??
                        "bg-muted-foreground/30 ring-transparent"
                      }`}
                    />
                  </span>
                </div>
              )}

              <div
                className={
                  timeline
                    ? "my-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border px-4 py-3"
                    : "flex flex-wrap items-center gap-x-4 gap-y-2"
                }
              >
              {showMap && (
              <div className="flex min-w-40 flex-1 items-center gap-2">
                {record.map_difficulty_level !== undefined && (
                  <DifficultyBadge
                    level={record.map_difficulty_level}
                    label={record.map_difficulty_label ?? ""}
                  />
                )}
                <Link
                  to={`/maps/${record.map_id}`}
                  className="truncate font-medium transition hover:text-primary hover:underline"
                >
                  {record.map_name ?? `地图 #${record.map_id}`}
                </Link>
                {record.map_author && (
                  <span
                    className="hidden truncate text-xs text-muted-foreground sm:inline"
                    title={`by ${record.map_author}`}
                  >
                    by {record.map_author}
                  </span>
                )}
              </div>
            )}

            {showUser && (
              <UserChip
                player={record}
                className={record.is_fc ? `text-sm ${FC_NAME_CLASS}` : "text-sm"}
              />
            )}

            {record.video_url ? (
              <a
                href={record.video_url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {platformLabel(record)}
                <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">历史收录 · 无视频链接</span>
            )}

            {record.cleared_on && !timeline && (
              <span className="text-xs text-muted-foreground">通关于 {record.cleared_on}</span>
            )}

            <StatusBadge status={record.status} />

            {record.status === "rejected" && record.reject_reason && (
              <span className="text-xs text-destructive">理由：{record.reject_reason}</span>
            )}

            {record.note && (
              <span
                className="w-full text-xs text-muted-foreground sm:w-auto sm:max-w-72 sm:truncate"
                title={record.note}
              >
                {record.note}
              </span>
            )}

            {reviewable && record.status !== "approved" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === record.id}
                onClick={() => void review(record, "approve")}
              >
                <Check className="size-4" />
                通过
              </Button>
            )}

            {reviewable && record.status === "approved" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === record.id}
                title="切换这条记录的 FC 金标记"
                onClick={() => void review(record, "approve", "", !record.is_fc)}
              >
                {record.is_fc ? "取消 FC" : "标为 FC"}
              </Button>
            )}

            {reviewable && record.status !== "rejected" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === record.id}
                onClick={() => {
                  setRejecting(record);
                  setReason("");
                }}
              >
                <X className="size-4" />
                驳回
              </Button>
            )}

            {(typeof deletable === "function" ? deletable(record) : Boolean(deletable)) && (
              <Button
                size="icon"
                variant="ghost"
                disabled={busyId === record.id}
                onClick={() => void remove(record)}
                aria-label="删除"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
              </div>
          </li>
          );
        })}
      </ul>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>驳回炼金记录</DialogTitle>
            <DialogDescription>说明驳回原因，提交者会在自己的记录里看到。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="reject-reason">驳回理由</Label>
            <Input
              id="reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="例如：视频无法访问 / 未打到终点 / 疑似修改器"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejecting) return;
                void review(rejecting, "reject", reason.trim());
                setRejecting(null);
              }}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
