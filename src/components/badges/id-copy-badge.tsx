"use client";

import { Icon } from "@iconify/react";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const IdCopyBadge = ({ id, iconOnly = false }: { id: string; iconOnly?: boolean }) => {
  return (
    <Badge
      variant="outline"
      className={cn(
        "hover:bg-zinc-100 bg-white cursor-pointer text-[10px] text-muted-foreground transition-colors",
        iconOnly && "p-1!"
      )}
      onClick={() => {
        navigator.clipboard.writeText(id);
        toast.success("ID Copied to clipboard");
      }}
    >
      {iconOnly === false && `ID: ${id}`}
      <Icon icon="ph:copy" />
    </Badge>
  );
};
