import { Link } from "react-router-dom";
import { LogOut, ShieldCheck, User as UserIcon, Upload, Menu } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth";

const NAV = [
  { to: "/", label: "难度榜单" },
  { to: "/maps", label: "地图库" },
  { to: "/players", label: "玩家" },
  { to: "/rules", label: "规则" }
];

export default function AppHeader() {
  const { user, ready, login, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            🟡
          </span>
          <span className="hidden sm:inline">Ballance 炼金成果站</span>
          <span className="sm:hidden">炼金站</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Button key={item.to} asChild variant="ghost" size="sm">
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}
          {user?.is_admin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">
                <ShieldCheck className="size-4" />
                审核台
              </Link>
            </Button>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link to="/submit">
              <Upload className="size-4" />
              提交炼金
            </Link>
          </Button>

          {!ready ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border/60 py-0.5 pr-2 pl-0.5 transition hover:bg-accent">
                  <Avatar className="size-7">
                    <AvatarImage src={user.avatar_url} alt={user.display_name} />
                    <AvatarFallback>{user.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-24 truncate text-sm" title={user.display_name}>
                    {user.display_name}
                  </span>
                  {user.is_admin && (
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      管理员
                    </Badge>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate" title={user.username}>
                  {user.username}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={`/players/${user.user_id}`}>
                    <UserIcon className="size-4" />
                    我的炼金主页
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/submit">
                    <Upload className="size-4" />
                    提交 / 更新成果
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut className="size-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={login}>
              登录（Ballance 论坛）
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="菜单"
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="flex flex-wrap gap-1 border-t border-border/60 px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Button key={item.to} asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}
          <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <Link to="/submit">提交炼金</Link>
          </Button>
          {user?.is_admin && (
            <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <Link to="/admin">审核台</Link>
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
