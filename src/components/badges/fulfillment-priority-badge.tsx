import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/types/admin.types";
import { fulfillmentPriority } from "@drizzle/schema";

type FulfillmentPriority = (typeof fulfillmentPriority.enumValues)[number];

function FulfillmentPriorityBadge({ status, className }: { status: FulfillmentPriority; className?: string }) {
  const colorMap: Record<FulfillmentPriority, string> = {
    normal: "bg-zinc-100 text-zinc-800 hover:bg-zinc-200",
    priority: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
    urgent: "bg-purple-100 text-purple-800 hover:bg-purple-200",
    critical: "bg-red-100 text-red-800 hover:bg-red-200",
    low: "bg-slate-200 text-slate-800 hover:bg-slate-300",
  };

  // Default to a neutral style if status is not found or normalize input
  const styles = colorMap[status];

  return (
    <Badge variant="secondary" className={cn(styles, className, "capitalize")}>
      {status.toLowerCase()}
    </Badge>
  );
}

export { FulfillmentPriorityBadge };
