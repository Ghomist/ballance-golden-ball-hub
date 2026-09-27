import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFoundView() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <Compass className="mx-auto size-8 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-bold">页面不存在</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        你访问的页面可能已被删除，或者链接写错了。
      </p>
      <Button asChild className="mt-6">
        <Link to="/">回到难度榜单</Link>
      </Button>
    </div>
  );
}
