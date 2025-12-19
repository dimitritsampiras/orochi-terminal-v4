import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function QueueStatusBadge({ queued, className }: { queued: boolean; className?: string }) {
  const colorMap: Record<string, string> = {
    queued: "bg-lime-50 text-black",
    unqueued: "bg-zinc-100 text-zinc-600",
  };
  return (
    <Badge
      variant="secondary"
      className={cn(colorMap[queued ? "queued" : "unqueued"], className, "flex items-center gap-2")}
    >
      <div className="flex items-center gap-2">
        <div className={cn(queued ? "bg-lime-600" : "bg-zinc-500", "size-1.5 rounded-full")} />
        {queued ? "Queued" : "Unqueued"}
      </div>
    </Badge>
  );
}

export { QueueStatusBadge };
