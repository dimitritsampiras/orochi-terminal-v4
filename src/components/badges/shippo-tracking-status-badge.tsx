import { Transaction } from "shippo";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

export const ShippoTrackingStatusBadge = ({ status }: { status: Transaction["trackingStatus"] }) => {
  const colorMap: Record<NonNullable<Transaction["trackingStatus"]>, string> = {
    DELIVERED: "bg-green-100 text-green-800",
    FAILURE: "bg-red-100 text-red-800",
    TRANSIT: "bg-blue-100 text-blue-800",
    RETURNED: "bg-yellow-100 text-yellow-800",
    UNKNOWN: "bg-gray-200 text-gray-700",
    PRE_TRANSIT: "border-transparent bg-gray-100 text-gray-800",
  };

  return (
    <Badge variant="secondary" className={cn(colorMap[status || "UNKNOWN"], "uppcase text-[10px]")}>
      {status?.replace("_", " ") || "UNKNOWN"}
    </Badge>
  );
};
