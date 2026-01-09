export const SITE = {
  routes: [
    {
      path: "/dashboard",
      name: "Dashboard",
      icon: "ph:house",
    },
    { path: "/assembly", name: "Assembly", icon: "ph:stack" },
    { path: "/sessions", name: "Sessions", icon: "ph:book" },
    {
      path: "/orders",
      name: "Orders",
      icon: "ph:tray",
    },
    {
      path: "/products",
      name: "Products",
      icon: "ph:tag",
    },
    {
      path: "/inventory",
      name: "Inventory",
      icon: "ph:cube",
    },
  ],
  subRoutes: [
    {
      path: "/packager",
      name: "Packager",
      icon: "ph:package",
    },
    {
      path: "/gate-scan",
      name: "Gate Scan",
      icon: "ph:barcode",
    },
    {
      path: "/profile",
      name: "Profile",
      icon: "ph:user",
    },
  ],
};
