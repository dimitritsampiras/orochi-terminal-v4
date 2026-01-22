"use client";

import { useRouter } from "next/navigation";
import { useProgress } from "@bprogress/next";
import { Icon } from "@iconify/react";
import Image from "next/image";
import dayjs from "dayjs";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderCompletionStatusBadge } from "@/components/badges/order-completion-status-badge";
import { FulfillmentStatusBadge } from "@/components/badges/fulfillment-status-badge";
import { CountryFlag } from "@/components/country-flag";
import { cn, getCarrierImage, isOrderComplete } from "@/lib/utils";
import { parseGid } from "@/lib/utils";
import { lineItems, orders, shipments } from "@drizzle/schema";
import { Badge } from "../ui/badge";
import { useOrderNavigation } from "@/lib/stores/order-navigation";
import { SessionOrder } from "../controllers/session-controller";
import { QueueStatusBadge } from "../badges/queue-status-badge";

interface SessionOrdersTableProps {
  orders: SessionOrder[];
  sessionId: number | string;
}

export function SessionOrdersTable({ orders, sessionId }: SessionOrdersTableProps) {
  const router = useRouter();
  const { start } = useProgress();
  const { setNavigation } = useOrderNavigation();

  const handleRowClick = (orderId: string) => {
    // Set navigation context with all orders in this session
    setNavigation(
      { type: "session", sessionId: Number(sessionId) },
      orders.map((o) => ({ id: o.id, name: o.name }))
    );
    start();
    router.push(`/orders/${parseGid(orderId)}?from=session&session_id=${sessionId}`);
  };

  const renderShipmentsCell = (order: SessionOrder) => {
    if (order.shipments.length === 0) {
      return <div className="font-light text-zinc-400 mx-4">No shipments</div>;
    }

    // Check if all shipments are refunded
    if (order.shipments.every((s) => s.isRefunded)) {
      return <div className="text-red-500 mx-4">Refunded</div>;
    }

    // Check if all shipments have missing label slips
    if (order.shipments.every((s) => s.labelSlipPath === null && s.isPurchased)) {
      return <div className="text-amber-500 mx-4">Label slip missing</div>;
    }

    // Check if all shipments have missing label slips

    // Get the last non-refunded shipment for carrier info
    const activeShipments = order.shipments.filter((s) => !s.isRefunded).toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const lastActiveShipment = activeShipments[activeShipments.length - 1];

    return (
      <div className="flex w-fit mx-4 items-center gap-2">
        {lastActiveShipment && lastActiveShipment.isPurchased ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {lastActiveShipment?.chosenCarrierName && (
                <Image
                  src={getCarrierImage(lastActiveShipment.chosenCarrierName) || ""}
                  alt={lastActiveShipment.chosenCarrierName}
                  width={16}
                  height={16}
                  className="h-4 w-4"
                  onError={(e) => {
                    // Hide image if it fails to load
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <Icon icon="ph:file-text" className="min-h-4 min-w-4" />
              <div className={cn("font-medium", activeShipments.length > 1 && 'text-amber-700')} > {activeShipments.length > 1 && 'Multiple'} Purchased</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon icon="ph:warning-circle" className="min-h-4 min-w-4 text-red-700" />
            <div className="font-normal text-red-700">Rate Only</div>
          </div>
        )
        }
      </div >
    );
  };

  return (
    <div className="overflow-clip rounded-md border bg-white">
      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Shipments</TableHead>
            <TableHead>In Latest Doc</TableHead>
            <TableHead>Completed Status</TableHead>
            <TableHead>Fulfillment Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length > 0 ? (
            orders.map((order, index) => {
              const hasActiveHold = order.orderHolds.some((hold) => !hold.isResolved);
              // const hasActiveHold = order.orderHolds.length > 0;
              if (order.name === '#66736') {
                console.log('active hold 66736', hasActiveHold, order.orderHolds);
              }

              return (
                <TableRow

                  key={order.id}
                  className={cn(
                    "hover:cursor-pointer hover:bg-gray-100",
                    index % 2 === 0 && "bg-gray-50",
                    order.displayIsCancelled && "opacity-60",
                    hasActiveHold && "bg-blue-100 hover:bg-blue-200!",
                    order.queued && "bg-lime-50!"
                  )}
                  onClick={() => handleRowClick(order.id)}
                >
                  <TableCell className="font-semibold">{order.name}</TableCell>
                  <TableCell className="text-zinc-500">{dayjs(order.createdAt).format("MMM D, YYYY")}</TableCell>
                  <TableCell>{order.displayCustomerName}</TableCell>
                  <TableCell>
                    <CountryFlag
                      countryName={order.displayDestinationCountryName}
                      countryCode={order.displayDestinationCountryCode || ""}
                    />
                  </TableCell>
                  <TableCell className="flex w-fit items-center gap-2">{renderShipmentsCell(order)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "flex items-center gap-1",
                        order.isInShippingDoc ? "pl-1" : "text-muted-foreground"
                      )}
                    >
                      {order.isInShippingDoc && <div className="ml-1 h-2 w-2 rounded-full bg-indigo-500" />}
                      {order.isInShippingDoc ? "In Merged Doc" : "Not in Merged Doc "}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <OrderCompletionStatusBadge status={isOrderComplete(order.lineItems)} />
                  </TableCell>
                  <TableCell>
                    {order.displayIsCancelled ? (
                      <Badge variant="destructive">Cancelled</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <FulfillmentStatusBadge status={order.displayFulfillmentStatus} />
                        {hasActiveHold && <Badge variant="outline" className="text-blue-500">On Hold</Badge>}
                        {order.queued && <QueueStatusBadge queued={order.queued} />}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                <p className="text-sm text-muted-foreground py-4">No orders found</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
