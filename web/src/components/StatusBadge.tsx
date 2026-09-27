import { Badge } from "@/components/ui/badge";
import type { RecordStatus } from "@/types";

const MAP: Record<RecordStatus, { label: string; className: string }> = {
  pending: { label: "待审核", className: "border-amber-500/40 bg-amber-500/10 text-amber-700" },
  approved: { label: "已通过", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" },
  rejected: { label: "已驳回", className: "border-red-500/40 bg-red-500/10 text-red-700" }
};

export default function StatusBadge({ status }: { status: RecordStatus }) {
  const item = MAP[status] ?? MAP.pending;
  return (
    <Badge variant="outline" className={item.className}>
      {item.label}
    </Badge>
  );
}
