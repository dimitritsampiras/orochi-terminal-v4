import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

function ActiveBadge({ status, className }: { status: boolean; className?: string }) {
  const colorMap: Record<'active' | 'inactive', string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-zinc-100 text-zinc-800",
  };

  // Default to a neutral style if status is not found or normalize input
  const styles = colorMap[status ? 'active' : 'inactive'];

  return (
    <Badge variant="secondary" className={cn(styles, className, "capitalize")}>
      {status ? 'Active' : 'Inactive'}
    </Badge>
  );
}

export { ActiveBadge };
