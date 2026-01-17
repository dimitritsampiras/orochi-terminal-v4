import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@iconify/react";
import Link from "next/link";

export default function OrderHoldsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon icon="ph:arrow-left" className="size-5" />
          </Link>
          <h1 className="page-title">Order Holds</h1>
        </div>
      </div>
      <div className="page-subtitle">Manage orders on hold</div>

      <div className="mt-4 flex md:flex-row flex-col gap-4 justify-between items-start md:items-center mb-6">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[140px]" />
      </div>

      <div className="space-y-1">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

