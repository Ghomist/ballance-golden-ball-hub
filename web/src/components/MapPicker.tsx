import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import DifficultyBadge from "@/components/DifficultyBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { MapItem } from "@/types";

interface MapPickerProps {
  maps: MapItem[];
  value?: number;
  onChange: (mapId: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** 可搜索的地图选择器：地图数量可能上百，直接在下拉里过滤 */
export default function MapPicker({ maps, value, onChange, placeholder = "选择地图", disabled }: MapPickerProps) {
  const [keyword, setKeyword] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return maps;
    return maps.filter(
      (item) => item.name.toLowerCase().includes(kw) || item.author.toLowerCase().includes(kw)
    );
  }, [maps, keyword]);

  return (
    <Select
      value={value ? String(value) : undefined}
      open={open}
      onOpenChange={setOpen}
      onValueChange={(next) => onChange(Number(next))}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <div className="sticky top-0 z-10 bg-popover p-2">
          <div className="relative">
            <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索地图名 / 作者"
              className="h-8 pl-8"
              // 阻止输入时触发下拉的键盘选择
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">没有匹配的地图</p>
        ) : (
          filtered.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              <span className="flex items-center gap-2">
                <DifficultyBadge level={item.difficulty_level} label={item.difficulty_label} />
                <span className="truncate" title={item.name}>
                  {item.name}
                </span>
                {item.author && (
                  <span
                    className="truncate text-xs text-muted-foreground"
                    title={`by ${item.author}`}
                  >
                    by {item.author}
                  </span>
                )}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
