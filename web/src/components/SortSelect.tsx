import { ArrowDownUp } from "lucide-react";

import OptionTabs from "@/components/OptionTabs";
import { cn } from "@/lib/utils";

interface SortSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label?: string;
  className?: string;
}

/** 列表排序选择器：纯前端排序，不改接口（按钮组样式，与首页模式切换一致） */
export default function SortSelect<T extends string>({
  value,
  onChange,
  options,
  label = "排序方式",
  className
}: SortSelectProps<T>) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ArrowDownUp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <OptionTabs value={value} onChange={onChange} options={options} label={label} />
    </div>
  );
}
