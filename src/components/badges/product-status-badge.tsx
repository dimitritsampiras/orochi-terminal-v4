import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/types/admin.types";

type ProductStatus = `${Product["status"]}`;

function ProductStatusBadge({ status, className }: { status: ProductStatus; className?: string }) {
  const colorMap: Record<ProductStatus, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
    DRAFT: "bg-blue-100 text-blue-800 hover:bg-blue-200",
    ARCHIVED: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    UNLISTED: "bg-gray-100 text-gray-800 hover:bg-gray-200",
  };

  // Default to a neutral style if status is not found or normalize input
  const styles = colorMap[status];

  return (
    <Badge variant="secondary" className={cn(styles, className, "capitalize")}>
      {status.toLowerCase()}
    </Badge>
  );
}

export { ProductStatusBadge };
