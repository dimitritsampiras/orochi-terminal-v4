import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { orderHoldCause } from "@drizzle/schema";

type OrderHoldCause = (typeof orderHoldCause.enumValues)[number];

function OrderHoldCauseBadge({
  cause,
  className,
  resolved = false,
}: {
  cause: OrderHoldCause;
  className?: string;
  resolved?: boolean;
}) {
  const colorMap: Record<OrderHoldCause, string> = {
    address_issue: "bg-white text-amber-600 border border-amber-200",
    shipping_issue: "bg-white text-red-600 border border-red-200",
    stock_shortage: "bg-white text-purple-600 border border-purple-200",
    other: "bg-white text-zinc-600 border border-zinc-200",
  };

  const labelMap: Record<OrderHoldCause, string> = {
    address_issue: "Address Issue",
    shipping_issue: "Shipping Issue",
    stock_shortage: "Stock Shortage",
    other: "Other",
  };

  const styles = colorMap[cause];

  return (
    <Badge variant="secondary" className={cn(styles, className, resolved && "bg-zinc-100 text-zinc-800 opacity-60 border-none")}>
      {labelMap[cause]}
    </Badge>
  );
}

export { OrderHoldCauseBadge };
export type { OrderHoldCause };
