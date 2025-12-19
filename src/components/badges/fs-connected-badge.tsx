import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function FSConnectedBadge({ status, className }: { status: boolean; className?: string }) {
  const colorMap: Record<"active" | "inactive", { background: string; text: string; icon: string }> = {
    active: { background: "bg-emerald-50", text: "text-emerald-800", icon: "bg-emerald-600" },
    inactive: { background: "bg-zinc-100", text: "text-zinc-800", icon: "bg-zinc-500" },
  };

  const styles = colorMap[status ? "active" : "inactive"];

  return (
    <Badge variant="secondary" className={cn(styles.background, "flex items-center gap-2", className)}>
      <div className="flex items-center gap-2">
        <div className={cn(styles.icon, "size-1.5 rounded-full", status && "animate-pulse")} />
        <div className={cn(styles.text, "capitalize")}>{status ? "Connected To File System" : "Not Connected To File System"}</div>
      </div>
    </Badge>
  );
}


