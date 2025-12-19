import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div>
      <h1 className="page-title">Orders</h1>
      <div className="page-subtitle">Manage customer orders</div>
      <div className="mt-4 flex md:flex-row flex-col gap-4 justify-between items-start md:items-center mb-6">
        <Skeleton className="h-10 w-[300px]" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
