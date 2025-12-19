import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OrderDisplayFulfillmentStatus, Product } from "@/lib/types/admin.types";
import { displayFulfillmentStatus, fulfillmentPriority } from "@drizzle/schema";

// type FulfillmentStatus = (typeof displayFulfillmentStatus.enumValues)[number];
type FulfillmentStatus = `${OrderDisplayFulfillmentStatus}`;

function FulfillmentStatusBadge({ status, className }: { status: FulfillmentStatus; className?: string }) {
  const colorMap: Record<FulfillmentStatus, string> = {
    FULFILLED: "bg-green-100 text-green-800",
    IN_PROGRESS: "bg-cyan-100 text-cyan-800",
    UNFULFILLED: "bg-amber-100 text-amber-800",
    ON_HOLD: "bg-red-100 text-red-800",
    OPEN: "bg-blue-100 text-blue-800",
    PARTIALLY_FULFILLED: "bg-orange-100 text-orange-800",
    PENDING_FULFILLMENT: "bg-yellow-100 text-yellow-800",
    REQUEST_DECLINED: "bg-purple-100 text-purple-800",
    RESTOCKED: "bg-cyan-100 text-cyan-800",
    SCHEDULED: "bg-cyan-100 text-cyan-800",
  };

  // Default to a neutral style if status is not found or normalize input
  const styles = colorMap[status];

  return (
    <Badge variant="secondary" className={cn(styles, className, "capitalize")}>
      {status.toLowerCase().replace("_", " ")}
    </Badge>
  );
}

export { FulfillmentStatusBadge };
