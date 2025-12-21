import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OrderDisplayFulfillmentStatus, Product } from "@/lib/types/admin.types";
import { displayFulfillmentStatus, lineItemCompletionStatus } from "@drizzle/schema";

// type FulfillmentStatus = (typeof displayFulfillmentStatus.enumValues)[number];
type LineItemStatus = (typeof lineItemCompletionStatus.enumValues)[number];

function LineItemStatusBadge({ status, className }: { status: LineItemStatus; className?: string }) {
  const colorMap: Record<LineItemStatus, string> = {
    not_printed: "bg-zinc-100 text-zinc-800",
    partially_printed: "bg-yellow-100 text-yellow-800",
    printed: "bg-emerald-100 text-emerald-800",
    in_stock: "bg-indigo-100 text-indigo-800",
    oos_blank: "bg-red-100 text-red-800",
    skipped: "bg-amber-100 text-amber-800",
    ignore: "border-gray-100 bg-gray-50 text-gray-800",
  };

  // Default to a neutral style if status is not found or normalize input
  const styles = colorMap[status];

  return (
    <Badge variant="secondary" className={cn(styles, className)}>
      {status.toLowerCase().replaceAll("_", " ")}
    </Badge>
  );
}

export { LineItemStatusBadge };
