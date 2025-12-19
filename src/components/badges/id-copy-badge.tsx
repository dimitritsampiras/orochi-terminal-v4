"use client";

import { Icon } from "@iconify/react";
import { Badge } from "../ui/badge";
import { toast } from "sonner";

export const IdCopyBadge = ({ id }: { id: string }) => {
  return (
    <Badge
      variant="outline"
      className="hover:bg-zinc-100 bg-white cursor-pointer text-[10px] text-muted-foreground transition-colors"
      onClick={() => {
        navigator.clipboard.writeText(id);
        toast.success("Copied to clipboard");
      }}
    >
      ID: {id}
      <Icon icon="ph:copy" />
    </Badge>
  );
};
