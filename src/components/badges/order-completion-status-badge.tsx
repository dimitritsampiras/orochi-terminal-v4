import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/types/admin.types";


function OrderCompletionStatusBadge({ status, className }: { status: boolean; className?: string }) {
  const colorMap: Record<"complete" | "incomplete", string> = {
    complete: "bg-blue-100 text-blue-800",
    incomplete: "bg-red-100 text-red-800",
  };

  // Default to a neutral style if status is not found or normalize input
  const styles = colorMap[status ? "complete" : "incomplete"];

  return (
    <Badge variant="secondary" className={cn(styles, className, "capitalize")}>
      {status ? "Complete" : "Incomplete"}
    </Badge>
  );
}

export { OrderCompletionStatusBadge };
