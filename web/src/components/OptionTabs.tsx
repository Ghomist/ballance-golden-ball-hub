import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface OptionTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  /** 无障碍标签 */
  label?: string;
  className?: string;
}

/** 多选一的按钮组：选项不多（2~5 个）时替代下拉框，样式与首页的模式切换一致 */
export default function OptionTabs<T extends string>({
  value,
  onChange,
  options,
  label,
  className
}: OptionTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={cn("w-fit", className)}
    >
      <TabsList aria-label={label} className="h-auto flex-wrap">
        {options.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
