import { userRole, userRoleV4 } from "@drizzle/schema";

type Role = (typeof userRoleV4.enumValues)[number];

// Resource permissions - single source of truth
const RESOURCE_ROLES: Record<string, readonly Role[] | undefined> = {
  dashboard: ["admin", "super_admin"], // all authenticated users
  assembly: ["super_admin", "admin", "warehouse_staff", 'operator'],
  sessions: ["super_admin", "admin"],
  orders: ["super_admin", "admin", "customer_support"],
  orderHolds: ["super_admin", "admin", "customer_support"],
  products: ["super_admin", "admin", "customer_support", "warehouse_staff", "operator"],
  inventory: ["super_admin", "admin", "customer_support", "warehouse_staff"],
  packager: ["super_admin", "admin", "warehouse_staff"],
  "gate-scan": ["super_admin", "admin", "warehouse_staff"],
  staff: ["super_admin", "admin"],
  analytics: ["super_admin", "admin"],
  profile: undefined, // all authenticated users
};

export type Resource = keyof typeof RESOURCE_ROLES;

export function getRolesForResource(resource: Resource): Role[] | undefined {
  return RESOURCE_ROLES[resource] as Role[] | undefined;
}

// Nav routes for UI (uses same resource keys)
export const SITE = {
  routes: [
    { resource: "dashboard" as const, path: "/dashboard", name: "Dashboard", icon: "ph:house" },
    { resource: "assembly" as const, path: "/assembly", name: "Assembly", icon: "ph:stack" },
    { resource: "sessions" as const, path: "/sessions", name: "Sessions", icon: "ph:book" },
    { resource: "orders" as const, path: "/orders", name: "Orders", icon: "ph:tray" },
    { resource: "orderHolds" as const, path: "/holds", name: "Order Holds", icon: "ph:call-bell" },
    { resource: "products" as const, path: "/products", name: "Products", icon: "ph:tag" },
    { resource: "inventory" as const, path: "/inventory", name: "Inventory", icon: "ph:cube" },
  ],
  subRoutes: [
    { resource: "packager" as const, path: "/packager", name: "Packager", icon: "ph:package" },
    { resource: "gate-scan" as const, path: "/gate-scan", name: "Gate Scan", icon: "ph:barcode" },
    { resource: "analytics" as const, path: "/analytics", name: "Analytics", icon: "ph:chart-line" },
    { resource: "staff" as const, path: "/staff", name: "Staff", icon: "ph:users" },
    { resource: "profile" as const, path: "/profile", name: "Profile", icon: "ph:user" },
  ],
};
