"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { orderHolds } from "@drizzle/schema";
import { OrderHoldCauseBadge } from "../badges/order-hold-cause-badge";
import { ResolvedStatusBadge } from "../badges/resolved-status-badge";
import dayjs from "dayjs";
import { parseGid, cn, truncate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useProgress } from "@bprogress/next";
import { ResolveHoldButton } from "../forms/order-forms/resolve-hold-button";
import { Icon } from "@iconify/react";
import { useOrderNavigation, type OrderNavigationContext } from "@/lib/stores/order-navigation";

type OrderHold = typeof orderHolds.$inferSelect;

interface OrderHoldsTableProps {
  holds: OrderHold[];
  /** Hide the order number column (for use on order detail page) */
  hideOrderColumn?: boolean;
}

function ViewHoldSheet({ hold, isResolved }: { hold: OrderHold; isResolved: boolean }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon-md" className="gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Icon icon="ph:eye" className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Hold Details
            <ResolvedStatusBadge resolvedAt={hold.resolvedAt} />
          </SheetTitle>
          <SheetDescription>Order {hold.orderNumber}</SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-6">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cause</div>
            <OrderHoldCauseBadge cause={hold.cause} resolved={isResolved} />
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reason</div>
            <p className="text-sm whitespace-pre-wrap">{hold.reasonNotes}</p>
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Created At</div>
            <div className="text-sm flex items-center gap-2">
              <Icon icon="ph:calendar-blank" className="size-4 text-muted-foreground" />
              {dayjs(hold.createdAt).format("MMMM D, YYYY [at] h:mm A")}
            </div>
          </div>

          {hold.resolvedAt && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Resolved At</div>
              <div className="text-sm flex items-center gap-2">
                <Icon icon="ph:check-circle" className="size-4 text-green-600" />
                {dayjs(hold.resolvedAt).format("MMMM D, YYYY [at] h:mm A")}
              </div>
            </div>
          )}

          {hold.resolvedNotes && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Resolution Notes</div>
              <p className="text-sm whitespace-pre-wrap">{hold.resolvedNotes}</p>
            </div>
          )}

          {!isResolved && (
            <div className="pt-4 border-t">
              <ResolveHoldButton holdId={hold.id} orderId={hold.orderId} disabled={isResolved} />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OrderHoldsTable({ holds, hideOrderColumn = false }: OrderHoldsTableProps) {
  const router = useRouter();
  const { start } = useProgress();
  const { setNavigation } = useOrderNavigation();

  const handleOrderClick = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Set navigation context with all visible orders from holds
    if (!hideOrderColumn) {
      const context: OrderNavigationContext = { type: "holds" };
      setNavigation(
        context,
        holds.map((h) => ({ id: h.orderId, name: h.orderNumber }))
      );
    }

    start();
    router.push(`/orders/${parseGid(orderId)}?from=holds`);
  };

  return (
    <div
      className={cn(
        "@container/table bg-white rounded-lg shadow-sm border border-zinc-200 w-full overflow-clip",
        hideOrderColumn && "shadow-none"
      )}
    >
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            {!hideOrderColumn && <TableHead>Order</TableHead>}
            <TableHead>Cause</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {holds.length > 0 ? (
            holds.map((hold) => {
              const isResolved = !!hold.resolvedAt;
              return (
                <TableRow
                  onClick={(e) => !hideOrderColumn && handleOrderClick(hold.orderId, e)}
                  key={hold.id}
                  className={cn(isResolved && "bg-zinc-50", !hideOrderColumn && "cursor-pointer hover:bg-zinc-50")}
                >
                  {!hideOrderColumn && (
                    <TableCell>
                      <div className={cn("font-semibold", isResolved && "text-muted-foreground")}>
                        {hold.orderNumber}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <OrderHoldCauseBadge cause={hold.cause} resolved={isResolved} />
                  </TableCell>
                  <TableCell className={cn("max-w-[200px]", isResolved && "text-muted-foreground")}>
                    <span className="block truncate">{truncate(hold.reasonNotes, 40)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Icon icon="ph:calendar-blank" className="size-4" />
                      {dayjs(hold.createdAt).format("MMM D, YYYY")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ResolvedStatusBadge resolvedAt={hold.resolvedAt} className={cn(isResolved && "opacity-60")} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <ViewHoldSheet hold={hold} isResolved={isResolved} />
                      <ResolveHoldButton holdId={hold.id} orderId={hold.orderId} disabled={isResolved} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={hideOrderColumn ? 5 : 6} className="text-center">
                <p className="text-sm text-muted-foreground py-4">No holds found</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export { OrderHoldsTable };
export type { OrderHold };
