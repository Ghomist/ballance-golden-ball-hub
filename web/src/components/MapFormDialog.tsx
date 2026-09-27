import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/api";
import type { MapItem } from "@/types";

interface MapFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  map?: MapItem | null;
  onSaved?: () => void;
}

const TIERS = ["T0", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "T13", "T14", "T15", "T16", "T17", "T18", "T19", "T20"];

export default function MapFormDialog({ open, onOpenChange, map, onSaved }: MapFormDialogProps) {
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [level, setLevel] = useState<number | null>(0);
  const [description, setDescription] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(map?.name ?? "");
    setAuthor(map?.author ?? "");
    setLevel(map?.difficulty_level ?? (map ? null : 0));
    setDescription(map?.description ?? "");
    setDownloadUrl(map?.download_url ?? "");
    setCoverUrl(map?.cover_url ?? "");
  }, [open, map]);

  async function save() {
    if (!name.trim()) {
      toast.error("地图名不能为空");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        author: author.trim(),
        difficulty_level: level,
        description: description.trim(),
        download_url: downloadUrl.trim(),
        cover_url: coverUrl.trim()
      };
      if (map) await api.maps.update(map.id, payload);
      else await api.maps.create(payload);
      toast.success(map ? "地图已更新" : "地图已创建");
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{map ? "编辑地图" : "新增地图"}</DialogTitle>
          <DialogDescription>
            难度 T0 最低，T20 之后统一记为 T20+；还没有人一命通关、暂时无法评档的地图选「暂无定义」。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="map-name">地图名</Label>
            <Input id="map-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="map-author">作者</Label>
              <Input
                id="map-author"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="地图作者 / 团队"
              />
            </div>
            <div className="grid gap-2">
              <Label>难度档</Label>
              <Select
                value={level === null ? "none" : level > 20 ? "21" : String(level)}
                onValueChange={(value) => setLevel(value === "none" ? null : Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIERS.map((tier, index) => (
                    <SelectItem key={tier} value={String(index)}>
                      {tier}
                    </SelectItem>
                  ))}
                  <SelectItem value="21">T20+（突破 T20 的超难图）</SelectItem>
                  <SelectItem value="none">暂无定义（还没人一命通关）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="map-download">下载链接（可选）</Label>
            <Input
              id="map-download"
              value={downloadUrl}
              onChange={(event) => setDownloadUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="map-cover">封面图链接（可选）</Label>
            <Input
              id="map-cover"
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="map-desc">简介（可选）</Label>
            <Textarea
              id="map-desc"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="地图特点、注意事项等"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
