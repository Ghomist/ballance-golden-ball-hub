import { Link } from "react-router-dom";
import { ChevronRight, CircleHelp, Info, ScrollText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FAQ, RULE_GROUPS, RULE_SOURCE } from "@/data/rules";

export default function RulesView() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2">
        <ScrollText className="size-5 text-primary" />
        <h1 className="text-2xl font-bold">炼金规则与常见问题</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        以下规则来自社区表格《{RULE_SOURCE}》，措辞保持原样。
      </p>

      <div className="mt-4 flex gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          本站展示方式与表格略有不同：表格里用「标红 / 灰色名字」区分的特殊情况，本站以站内标签表示；
          表格里「完成者」单元格上的超链接（该次通关的视频）已一并导入，点完成者的记录即可跳转到 B 站视频。
          难度档沿用 T0 → T20+ 与「暂无定义」。
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {RULE_GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-2">
        <CircleHelp className="size-5 text-primary" />
        <h2 className="text-xl font-bold">常见问题</h2>
      </div>

      <div className="mt-3 divide-y divide-border rounded-lg border border-border">
        {FAQ.map((item) => (
          <details key={item.q} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
              {item.q}
            </summary>
            <p className="mt-2 pl-6 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-gradient-to-br from-amber-50 to-background px-5 py-4">
        <p className="text-sm">
          规则清楚了？把你的通关视频链接提交上来，管理员审核通过后就会出现在
          <Link to="/" className="mx-1 font-medium text-primary hover:underline">
            难度榜单
          </Link>
          里。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/submit">
              <Upload className="size-4" />
              提交我的炼金成果
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/maps">浏览地图库</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
