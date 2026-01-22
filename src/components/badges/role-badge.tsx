import type { userRoleV4 } from "@drizzle/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = (typeof userRoleV4.enumValues)[number];

const ROLE_COLORS: Record<Role, string> = {
  super_admin: "bg-violet-100 text-violet-800",
  admin: "bg-blue-100 text-blue-800",
  warehouse_staff: "bg-slate-100 text-slate-800",
  customer_support: "bg-lime-100 text-lime-800",
  operator: "bg-orange-100 text-orange-800",
};

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  warehouse_staff: "Warehouse Staff",
  customer_support: "Customer Support",
  operator: "Line Operator",
};

export function RoleBadge({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn(ROLE_COLORS[role], className)}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}
