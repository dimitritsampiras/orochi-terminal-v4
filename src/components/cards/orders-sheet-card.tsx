"use client";

import { useState } from "react";
import { cn, isOrderComplete, parseGid } from "@/lib/utils";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { GetOrderResponse } from "@/lib/types/api";
import { Spinner } from "../ui/spinner";
import { IdCopyBadge } from "../badges/id-copy-badge";
import { CountryFlag } from "../country-flag";
import { OrderCompletionStatusBadge } from "../badges/order-completion-status-badge";
import { FulfillmentStatusBadge } from "../badges/fulfillment-status-badge";
import { OrderLineItems } from "./order-line-items";
import { ShippingInfo } from "./shipping-info";
import { OrderLogs } from "./order-logs";

interface Order {
  id: string;
  name: string;
  createdAt: Date | null;
  displayCustomerName: string | null;
  displayDestinationCountryCode: string | null;
  displayDestinationCountryName: string | null;
}

interface OrdersSheetCardProps {
  orders: Order[];
  title: string;
  description: string;
  icon: string;
  footerText: string;
}

export function OrdersSheetCard({ orders, title, description, icon, footerText }: OrdersSheetCardProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const {
    data: selectedOrder,
    isLoading: isLoadingOrder,
    error: orderError,
  } = useQuery({
    queryKey: ["order", selectedOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${parseGid(selectedOrderId!)}`);
      const data = (await res.json()) as GetOrderResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to fetch order");
      }
      return data.data;
    },
    enabled: !!selectedOrderId,
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Card className="sm:w-64! gap-2 shadow-none bg-white hover:bg-zinc-50! transition-colors! cursor-pointer">
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <Icon icon={icon} className="size-3" />
              {title}
            </CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2 font-semibold tabular-nums @[250px]/card:text-3xl">
              {orders.length}
            </CardTitle>
            <CardAction>
              <Icon icon="ph:eye" className="size-4" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div>{footerText}</div>
          </CardFooter>
        </Card>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={cn(
          "w-full transition-all duration-300 flex flex-col overflow-hidden",
          selectedOrderId ? "sm:max-w-5xl" : "sm:max-w-lg"
        )}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon icon={icon} className="size-4" />
            {title}
          </SheetTitle>
          <SheetDescription className="min-h-[40px]">{description}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-row-reverse flex-1 overflow-hidden">
          {/* Main orders list - fixed width */}
          <div className="flex-1 overflow-y-auto px-4 py-2 sm:max-w-lg sm:min-w-lg">
            {orders.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No orders found</div>
            ) : (
              <div className="space-y-1 pb-4">
                {orders
                  .toSorted((a, b) => {
                    return new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime();
                  })
                  .map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg hover:bg-zinc-100 transition-colors group cursor-pointer",
                        selectedOrderId === order.id && "bg-zinc-100"
                      )}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm group-hover:text-zinc-900">{order.name}</span>
                        <div className="flex items-center gap-2">
                          <CountryFlag
                            countryCode={order.displayDestinationCountryCode || ""}
                            countryName={order.displayDestinationCountryName || ""}
                            className="text-xs"
                          />
                          <span className="text-xs text-muted-foreground">
                            {order.displayCustomerName || "No customer name"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {order.createdAt ? dayjs(order.createdAt).format("MMM D, YYYY") : ""}
                        </span>
                        <Icon
                          icon="ph:caret-right"
                          className="size-4 text-zinc-400 group-hover:text-zinc-600 transition-colors"
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Order detail panel */}
          {selectedOrderId && (
            <div className="border-r bg-zinc-50 p-4 overflow-y-auto w-full">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm">Order Details</h4>
                <Button size="icon-sm" variant="ghost" onClick={() => setSelectedOrderId(null)}>
                  <Icon icon="ph:x" className="size-3" />
                </Button>
              </div>

              {isLoadingOrder && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Spinner />
                  Loading...
                </div>
              )}

              {orderError && <p className="text-sm text-red-600">{orderError.message}</p>}

              {selectedOrder && (
                <div className="space-y-4">
                  {/* TODO: Implement order detail UI here */}
                  <div className="text-sm">
                    <div className="font-medium">{selectedOrder.name}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-muted-foreground text-xs">
                        {selectedOrder.createdAt && dayjs(selectedOrder.createdAt).format("MMM D, YYYY h:mm A")}
                      </div>
                      <IdCopyBadge id={selectedOrder.id} iconOnly />
                    </div>
                    <Link
                      href={`/orders/${parseGid(selectedOrderId)}?from=dashboard`}
                      className="text-xs text-blue-600 hover:underline"
                      target="_blank"
                    >
                      View full order →
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedOrder.batches.length > 0 && (
                      <div className="text-sm bg-blue-50 w-fit px-2 py-1 text-blue-700">
                        In Session{selectedOrder.batches.length > 1 ? "s" : ""}{" "}
                        <Link href="/batches" className="text-blue-800 font-semibold hover:underline" target="_blank">
                          {selectedOrder.batches.map((batch) => batch.id).join(", ")}
                        </Link>
                      </div>
                    )}
                    <CountryFlag
                      countryCode={selectedOrder.displayDestinationCountryCode || ""}
                      countryName={selectedOrder.displayDestinationCountryName || ""}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderCompletionStatusBadge status={isOrderComplete(selectedOrder.lineItems)} />
                    <FulfillmentStatusBadge status={selectedOrder.displayFulfillmentStatus} />
                  </div>

                  <OrderLineItems
                    orderId={selectedOrderId}
                    shopifyLineItems={selectedOrder.shopifyOrder.lineItems.nodes}
                    databaseLineItems={selectedOrder.lineItems}
                  />
                  <ShippingInfo
                    orderId={selectedOrder.id}
                    orderShipmentData={selectedOrder.shipmentData}
                    lineItems={selectedOrder.shopifyOrder.lineItems.nodes}
                    hideButtons={true}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
