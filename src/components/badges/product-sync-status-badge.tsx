import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type ProductSyncStatusBadgeProps = {
  status: "not_synced" | "partially_synced" | "synced" | "black_label";
  isBlackLabel?: boolean;
  className?: string;
};

function ProductSyncStatusBadge({ status, isBlackLabel = false, className }: ProductSyncStatusBadgeProps) {
  const colorMap: Record<
    "not_synced" | "partially_synced" | "synced" | "black_label",
    {
      background: string;
      text: string;
      icon: string;
    }
  > = {
    not_synced: { background: "bg-red-100", text: "text-red-600", icon: "bg-red-500" },
    partially_synced: { background: "bg-amber-50", text: "text-amber-800", icon: "bg-amber-500" },
    synced: { background: "bg-gray-50", text: "text-gray-800", icon: "bg-gray-500" },
    black_label: { background: "bg-indigo-50", text: "text-indigo-800", icon: "bg-indigo-500" },
  };

  return (
    <Badge
      variant="secondary"
      className={cn(colorMap[isBlackLabel ? "black_label" : status].background, "flex items-center gap-2", className)}
    >
      <div className="flex items-center gap-2">
        <div className={cn(colorMap[isBlackLabel ? "black_label" : status].icon, "size-1.5 rounded-full")} />
        <div className={cn(colorMap[isBlackLabel ? "black_label" : status].text)}>
          {isBlackLabel
            ? "Black Label"
            : status === "not_synced"
            ? "Not Synced"
            : status === "partially_synced"
            ? "Partially Synced"
            : "Synced"}
        </div>
      </div>
    </Badge>
  );
}

export { ProductSyncStatusBadge };
