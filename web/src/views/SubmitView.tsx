import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CircleHelp, ListChecks, Upload } from "lucide-react";
import { toast } from "sonner";

import RecordList from "@/components/RecordList";
import SubmitDialog from "@/components/SubmitDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/api";
import { useAuthStore } from "@/stores/auth";
import type { ClearRecord, MapItem } from "@/types";

const RULES = [
  "一条记录 = 一张地图的一次炼金成功证明，用视频链接作为凭证（B 站 / YouTube 等公开链接）。",
  "同一张地图重复提交会覆盖旧链接，并重新进入待审核状态，所以换更好的录像直接重交即可。",
  "管理员审核通过后，你的名字会出现在地图详情页和对应难度的榜单上。",
  "请勿提交他人录像或经过剪辑拼接的伪证，被举报核实后会驳回并可能封禁账号。"
];

export default function SubmitView() {
  const { user, ready, login } = useAuthStore();
  const [maps, setMaps] = useState<MapItem[]>([]);
  const [records, setRecords] = useState<ClearRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadMaps = useCallback(async () => {
    try {
      const list = await api.maps.list({ limit: 200, sort: "difficulty_desc" });
      setMaps(list.items);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "地图列表加载失败");
    }
  }, []);

  const loadMine = useCallback(async () => {
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api.records.mine({ limit: 200 });
      setRecords(list.items);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "我的记录加载失败");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">提交炼金成果</h1>
          <p className="text-sm text-muted-foreground">
            选择地图 → 填视频链接 → 管理员审核通过后公开展示
          </p>
        </div>
        {user && (
          <Button className="ml-auto" onClick={() => setDialogOpen(true)}>
            <Upload className="size-4" />
            新建提交
          </Button>
        )}
      </div>

      {!ready ? (
        <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
      ) : !user ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-medium">需要先登录 Ballance 论坛账号</p>
            <p className="max-w-md text-sm text-muted-foreground">
              炼金成果与你的论坛账号绑定，方便大家核对与交流。登录使用论坛的 OAuth 授权，本站不会接触你的密码。
            </p>
            <Button onClick={login}>登录 Ballance 论坛</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleHelp className="size-4" />
                提交规则
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <section className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ListChecks className="size-4" />
              我的炼金记录（{records.length}）
            </h2>
            <div className="mt-3">
              {loading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>
              ) : records.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  还没有提交过，点击右上角「新建提交」上传第一份炼金录像吧。
                </div>
              ) : (
                <RecordList
                  records={records}
                  sortable
                  timeline
                  deletable
                  onChanged={loadMine}
                />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              想补充或替换录像？直接重新提交同一张地图即可；也可以到
              <Link to="/maps" className="mx-1 text-primary hover:underline">
                地图库
              </Link>
              里找到地图再提交。
            </p>
          </section>
        </>
      )}

      <SubmitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        maps={maps}
        onSubmitted={loadMine}
      />
    </div>
  );
}
