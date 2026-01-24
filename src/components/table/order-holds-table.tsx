"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { orderHolds } from "@drizzle/schema";
import { OrderHoldCauseBadge } from "../badges/order-hold-cause-badge";
import { ResolvedStatusBadge } from "../badges/resolved-status-badge";
import dayjs from "dayjs";
import { parseGid, cn, isOrderComplete } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useProgress } from "@bprogress/next";
import { ResolveHoldButton } from "../forms/order-forms/resolve-hold-button";
import { Icon } from "@iconify/react";
import {
  useOrderNavigation,
  type OrderNavigationContext,
} from "@/lib/stores/order-navigation";
import { useQuery } from "@tanstack/react-query";
import { GetOrderResponse } from "@/lib/types/api";
import { Spinner } from "../ui/spinner";
import { IdCopyBadge } from "../badges/id-copy-badge";
import { CountryFlag } from "../country-flag";
import { OrderCompletionStatusBadge } from "../badges/order-completion-status-badge";
import { FulfillmentStatusBadge } from "../badges/fulfillment-status-badge";
import { OrderLineItems } from "../cards/order-line-items";
import { ShippingInfo } from "../cards/shipping-info";
import Link from "next/link";

type OrderHold = typeof orderHolds.$inferSelect;

interface OrderHoldsTableProps {
  holds: OrderHold[];
  /** Hide the order number column (for use on order detail page) */
  hideOrderColumn?: boolean;
}

function ViewHoldSheet({
  hold,
  isResolved,
}: {
  hold: OrderHold;
  isResolved: boolean;
}) {
  const [open, setOpen] = useState(false);

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order", hold.orderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${parseGid(hold.orderId)}`);
      const data = (await res.json()) as GetOrderResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to fetch order");
      }
      return data.data;
    },
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon-md"
          className="gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon icon="ph:eye" className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Hold Details
            <ResolvedStatusBadge resolvedAt={hold.resolvedAt} />
          </SheetTitle>
          <SheetDescription>Order {hold.orderNumber}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-6">
          {/* Hold Info */}
          <div className="space-y-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Cause
              </div>
              <OrderHoldCauseBadge cause={hold.cause} resolved={isResolved} />
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Reason
              </div>
              <p className="text-sm whitespace-pre-wrap">{hold.reasonNotes}</p>
            </div>

            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Created At
              </div>
              <div className="text-sm flex items-center gap-2">
                <Icon
                  icon="ph:calendar-blank"
                  className="size-4 text-muted-foreground"
                />
                {dayjs(hold.createdAt).format("MMMM D, YYYY [at] h:mm A")}
              </div>
            </div>

            {hold.resolvedAt && (
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Resolved At
                </div>
                <div className="text-sm flex items-center gap-2">
                  <Icon
                    icon="ph:check-circle"
                    className="size-4 text-green-600"
                  />
                  {dayjs(hold.resolvedAt).format("MMMM D, YYYY [at] h:mm A")}
                </div>
              </div>
            )}

            {hold.resolvedNotes && (
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Resolution Notes
                </div>
                <p className="text-sm whitespace-pre-wrap">
                  {hold.resolvedNotes}
                </p>
              </div>
            )}

            {!isResolved && (
              <div className="pt-4 border-t">
                <ResolveHoldButton
                  holdId={hold.id}
                  orderId={hold.orderId}
                  disabled={isResolved}
                />
              </div>
            )}
          </div>

          {/* Order Info */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm mb-4">Order Details</h4>

            {isLoading && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Spinner />
                Loading...
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error.message}</p>}

            {order && (
              <div className="space-y-4">
                <div className="text-sm">
                  <div className="font-medium">{order.name}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-muted-foreground text-xs">
                      {order.createdAt && dayjs(order.createdAt).format("MMM D, YYYY h:mm A")}
                    </div>
                    <IdCopyBadge id={order.id} iconOnly />
                  </div>
                  <Link
                    href={`/orders/${parseGid(hold.orderId)}?from=holds`}
                    className="text-xs text-blue-600 hover:underline"
                    target="_blank"
                  >
                    View full order →
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  {order.batches.length > 0 && (
                    <div className="text-sm bg-blue-50 w-fit px-2 py-1 text-blue-700">
                      In Session{order.batches.length > 1 ? "s" : ""}{" "}
                      <Link href="/batches" className="text-blue-800 font-semibold hover:underline" target="_blank">
                        {order.batches.map((batch) => batch.id).join(", ")}
                      </Link>
                    </div>
                  )}
                  <CountryFlag
                    countryCode={order.displayDestinationCountryCode || ""}
                    countryName={order.displayDestinationCountryName || ""}
                    className="text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <OrderCompletionStatusBadge status={isOrderComplete(order.lineItems)} />
                  <FulfillmentStatusBadge status={order.displayFulfillmentStatus} />
                </div>

                <OrderLineItems
                  orderId={hold.orderId}
                  shopifyLineItems={order.shopifyOrder.lineItems.nodes}
                  databaseLineItems={order.lineItems}
                />
                <ShippingInfo
                  orderId={order.id}
                  orderShipmentData={order.shipmentData}
                  lineItems={order.shopifyOrder.lineItems.nodes}
                  hideButtons={true}
                />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OrderHoldsTable({
  holds,
  hideOrderColumn = false,
}: OrderHoldsTableProps) {
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
                  onClick={(e) =>
                    !hideOrderColumn && handleOrderClick(hold.orderId, e)
                  }
                  key={hold.id}
                  className={cn(
                    isResolved && "bg-zinc-50",
                    !hideOrderColumn && "cursor-pointer hover:bg-zinc-50"
                  )}
                >
                  {!hideOrderColumn && (
                    <TableCell>
                      <div
                        className={cn(
                          "font-semibold",
                          isResolved && "text-muted-foreground"
                        )}
                      >
                        {hold.orderNumber}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <OrderHoldCauseBadge
                      cause={hold.cause}
                      resolved={isResolved}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-[300px] whitespace-pre-wrap",
                      isResolved && "text-muted-foreground"
                    )}
                  >
                    <span className="">{hold.reasonNotes}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Icon icon="ph:calendar-blank" className="size-4" />
                      {dayjs(hold.createdAt).format("MMM D, YYYY")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ResolvedStatusBadge
                      resolvedAt={hold.resolvedAt}
                      className={cn(isResolved && "opacity-60")}
                    />
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-2">
                      <ViewHoldSheet hold={hold} isResolved={isResolved} />
                      <ResolveHoldButton
                        holdId={hold.id}
                        orderId={hold.orderId}
                        disabled={isResolved}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={hideOrderColumn ? 5 : 6}
                className="text-center"
              >
                <p className="text-sm text-muted-foreground py-4">
                  No holds found
                </p>
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
