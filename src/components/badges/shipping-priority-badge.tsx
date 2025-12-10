import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/types/admin.types";
import { shippingPriority } from "@drizzle/schema";

type ShippingPriority = (typeof shippingPriority.enumValues)[number];

function ShippingPriorityBadge({ status, className }: { status: ShippingPriority; className?: string }) {
  const colorMap: Record<ShippingPriority, string> = {
    express: "bg-violet-100 text-violet-800",
    fastest: "bg-blue-100 text-blue-800",
    standard: "bg-zinc-100 text-zinc-800",
  };

  // Default to a neutral style if status is not found or normalize input
  const styles = colorMap[status];

  return (
    <Badge variant="secondary" className={cn(styles, className, "capitalize")}>
      {status.toLowerCase()}
    </Badge>
  );
}

export { ShippingPriorityBadge };
