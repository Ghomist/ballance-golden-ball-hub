import { Link } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Player } from "@/types";

interface UserChipProps {
  player: Pick<Player, "user_id" | "username" | "display_name" | "avatar_url"> & { banned?: boolean };
  size?: "sm" | "md";
  className?: string;
  showLink?: boolean;
}

export default function UserChip({ player, size = "sm", className, showLink = true }: UserChipProps) {
  const body = (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Avatar className={size === "sm" ? "size-5" : "size-7"}>
        <AvatarImage src={player.avatar_url} alt={player.display_name} />
        <AvatarFallback className="text-[10px]">
          {player.display_name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate" title={player.display_name}>
        {player.display_name}
      </span>
      {player.banned && <span className="text-xs text-destructive">已封禁</span>}
    </span>
  );

  if (!showLink) return body;
  return (
    <Link to={`/players/${player.user_id}`} className="transition hover:text-primary hover:underline">
      {body}
    </Link>
  );
}
