import { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import MapPicker from "@/components/MapPicker";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/api";
import type { MapItem } from "@/types";

interface SubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maps: MapItem[];
  defaultMapId?: number;
  onSubmitted?: () => void;
}

export default function SubmitDialog({
  open,
  onOpenChange,
  maps,
  defaultMapId,
  onSubmitted
}: SubmitDialogProps) {
  const [mapId, setMapId] = useState<number | undefined>(defaultMapId);
  const selectedMap = maps.find((item) => item.id === mapId);
  const [videoUrl, setVideoUrl] = useState("");
  const [clearedOn, setClearedOn] = useState("");
  const [isFc, setIsFc] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMapId(defaultMapId);
      setVideoUrl("");
      setClearedOn("");
      setIsFc(false);
      setNote("");
    }
  }, [open, defaultMapId]);

  async function submit() {
    if (!mapId) {
      toast.error("请先选择地图");
      return;
    }
    if (!/^https?:\/\/\S+$/i.test(videoUrl.trim())) {
      toast.error("请填写完整的视频链接（http/https 开头）");
      return;
    }

    setSubmitting(true);
    try {
      await api.records.submit({
        map_id: mapId,
        video_url: videoUrl.trim(),
        cleared_on: clearedOn,
        is_fc: isFc,
        note: note.trim()
      });
      toast.success("提交成功，等待管理员审核", {
        description: "审核通过后会出现在地图详情与难度榜单里。"
      });
      onOpenChange(false);
      onSubmitted?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>提交炼金成果</DialogTitle>
          <DialogDescription>
            选择你成功炼金（通关）的地图，并附上视频链接作为证明。同一张地图重复提交会覆盖旧链接并重新进入审核。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>地图</Label>
            <MapPicker maps={maps} value={mapId} onChange={setMapId} />
            {selectedMap?.description && (
              <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs">
                <span className="mr-2 font-medium text-amber-400">该图特殊规则</span>
                {selectedMap.description}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="video-url">视频链接</Label>
            <Input
              id="video-url"
              placeholder="https://www.bilibili.com/video/BV... 或 YouTube 链接"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              支持 B 站 / YouTube 等公开可访问的链接，建议视频里能看清通关过程与终点结算。
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cleared-on">通关日期（可选）</Label>
              <Input
                id="cleared-on"
                type="date"
                value={clearedOn}
                onChange={(event) => setClearedOn(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-400/60 bg-amber-400/10 px-3 py-3">
            <div className="grid gap-1">
              <Label htmlFor="is-fc" className="text-sm font-medium">
                这次是 FC 金
              </Label>
              <p className="text-xs text-muted-foreground">
                FC 金是社区里规定动作、不能吃分的那类金（表格里给玩家格填色的记录）。不确定就别勾，管理员会复核。
              </p>
            </div>
            <Switch id="is-fc" checked={isFc} onCheckedChange={setIsFc} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note">备注（可选）</Label>
            <Textarea
              id="note"
              rows={3}
              maxLength={500}
              placeholder="例如：使用球型、用了多少命、是否刷新纪录等"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            提交审核
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
