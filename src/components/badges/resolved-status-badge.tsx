import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import dayjs from "dayjs";

interface ResolvedStatusBadgeProps {
  resolvedAt: Date | null;
  className?: string;
}

function ResolvedStatusBadge({ resolvedAt, className }: ResolvedStatusBadgeProps) {
  if (resolvedAt) {
    return (
      <Badge variant="secondary" className={cn("bg-blue-100 text-blue-800", className)}>
        <div className="flex items-center gap-1 font-semibold">
          <div className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
          Resolved
          <span className="font-normal">|</span>
          <span className="font-normal"> {dayjs(resolvedAt).format("MMM D")}</span>
        </div>
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={cn("bg-rose-100 text-rose-800", className)}>
      <div className="flex items-center gap-1">
        <div className="size-1.5 rounded-full bg-rose-600 animate-pulse" />
        Active
      </div>
    </Badge>
  );
}

export { ResolvedStatusBadge };
