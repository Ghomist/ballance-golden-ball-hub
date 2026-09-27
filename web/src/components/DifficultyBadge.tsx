import { cn } from "@/lib/utils";

/**
 * T0 → T20+ 的难度配色：一条平滑的彩虹——钢蓝 → 青 → 绿 → 黄 → 琥珀 → 橙 → 红 → 玫红 → 品红。
 * 相邻档位色相各差约 13°、饱和度/明度也是线性推进，所以每个难度都有自己的颜色、过渡均匀，
 * 又不会在视觉上裂成"蓝档 / 黄档 / 红档"几块。
 * 最后一项是 ≥ T21（显示为「T20+」）的颜色。
 */
const TIER_COLORS = [
  "#8ba8d0", // T0
  "#86b5d0", // T1
  "#82c5d1", // T2
  "#7dd2cc", // T3
  "#78d3b8", // T4
  "#72d4a2", // T5
  "#6dd58a", // T6
  "#68d66e", // T7
  "#75d762", // T8
  "#8cd95d", // T9
  "#a6da57", // T10
  "#c2dc52", // T11
  "#ddd84c", // T12
  "#dfb846", // T13
  "#e19540", // T14
  "#e36e3a", // T15
  "#e54434", // T16
  "#e72e45", // T17
  "#e9286a", // T18
  "#eb2193", // T19
  "#ee1bc0", // T20
  "#f014f0" // T20+（≥ 21）
];

function tierIndex(level: number | null): number {
  if (level === null) return -1;
  return Math.min(level, TIER_COLORS.length - 1);
}

/** 难度纯色（色块 / 徽标底色用）：null = 暂无定义，用中性灰 */
export function difficultyColor(level: number | null): string {
  const index = tierIndex(level);
  return index < 0 ? "#a1a1aa" : TIER_COLORS[index];
}

/** 徽标文字色：按色相分段取同色系深色，只为对比度，不影响色块与徽标底色 */
export function difficultyTone(level: number | null): string {
  const index = tierIndex(level);
  if (index < 0) return "border-dashed border-muted-foreground/50 bg-muted text-muted-foreground";
  if (index <= 3) return "text-sky-700";
  if (index <= 8) return "text-emerald-700";
  if (index <= 13) return "text-amber-700";
  if (index <= 17) return "text-orange-700";
  if (index <= 20) return "text-rose-700";
  return "text-fuchsia-700";
}

interface DifficultyBadgeProps {
  level: number | null;
  label: string;
  className?: string;
}

export default function DifficultyBadge({ level, label, className }: DifficultyBadgeProps) {
  const color = difficultyColor(level);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums",
        difficultyTone(level),
        className
      )}
      style={
        level === null
          ? undefined
          : { backgroundColor: `${color}26`, borderColor: `${color}80` }
      }
    >
      {label}
    </span>
  );
}
