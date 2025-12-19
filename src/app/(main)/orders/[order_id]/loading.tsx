import { Skeleton } from "@/components/ui/skeleton";

export default function OrderLoading() {
  return (
    <div>
      <Skeleton className="h-9 w-48 mb-3" />
      <div className="flex items-center gap-2 mt-3 mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mt-4 flex items-center gap-4 mb-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>

      <div className="my-4 flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="mb-24 mt-2 grid-cols-[2fr_1fr] gap-4 md:grid">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="flex flex-col gap-4 sm:mt-0 mt-4">
          <div className="flex items-center gap-2 w-full">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

