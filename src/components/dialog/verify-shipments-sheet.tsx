"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

import { Button, buttonVariants } from "@/components/ui/button";

import { getCarrierImage, parseGid, sleep } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { shipments, batches } from "@drizzle/schema";
import type { SessionOrder } from "../controllers/session-controller";
import { getShipmentIssue, type ShipmentIssueType } from "@/lib/core/shipping/shipping-utils";
import { ShippingAPI } from "../cards/shipping-info";
import dayjs from "dayjs";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { CountryFlag } from "../country-flag";
import { useMutation } from "@tanstack/react-query";
import type { CreateOrderHoldSchema } from "@/lib/schemas/order-hold-schema";
import type { CreateOrderHoldResponse } from "@/lib/types/api";
import { toast } from "sonner";
import Link from "next/link";

type Shipment = typeof shipments.$inferSelect;

interface ShippingIssuesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: SessionOrder[];
  session: typeof batches.$inferSelect;
}

export function VerifyShipmentsSheet({
  open,
  onOpenChange,
  orders,
  session,
}: ShippingIssuesDialogProps) {
  const router = useRouter();

  const verifyShipmentsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/batches/${session.id}/verify-shipments`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to verify shipments");
      }
    },
  });

  const addHoldMutation = useMutation({
    mutationFn: async ({
      orderId,
      issue,
    }: {
      orderId: string;
      issue: string;
    }) => {
      const res = await fetch(`/api/orders/${parseGid(orderId)}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cause: "shipping_issue",
          reasonNotes: `Shipping issue - ${issue}`,
        } satisfies CreateOrderHoldSchema),
      });
      if (!res.ok) {
        throw new Error("Failed to add hold");
      }
      const { data, error } = (await res.json()) as CreateOrderHoldResponse;

      if (!data) {
        throw new Error(error ?? "Failed to add hold");
      }

      router.refresh();
      await sleep(1000);
      return data;
    },
  });

  const addHold = (orderId: string, issue: string) => {
    toast.promise(addHoldMutation.mutateAsync({ orderId, issue }), {
      loading: "Adding hold...",
      success: "Order hold added",
      error: (err) => err.message || "Failed to add hold",
    });
  };

  const verifyShipments = () => {
    toast.promise(
      async () => {
        await verifyShipmentsMutation.mutateAsync();
        router.refresh();
        await sleep(1200);
        onOpenChange(false);
      },
      {
        loading: "Verifying shipments...",
        success: "Shipments verified",
        error: (err) => err.message || "Failed to verify shipments",
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Shipping Issues</SheetTitle>
          <SheetDescription>
            {orders.length === 0
              ? "All orders have valid shipments."
              : `${orders.length} order${orders.length !== 1 ? "s" : ""} with shipping issues.`}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 flex-1 overflow-y-auto">
          {session.shipmentsVerifiedAt && (
            <Alert className="bg-green-50 border-green-200 mb-4">
              <Icon icon="ph:check-circle" className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Verified</AlertTitle>
              <AlertDescription className="text-green-700">
                Shipments were verified on{" "}
                {session.shipmentsVerifiedAt
                  ? new Date(session.shipmentsVerifiedAt).toLocaleString()
                  : "unknown"}
                .
              </AlertDescription>
            </Alert>
          )}

          {orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => {
                const issue = getShipmentIssue(order.shipments);
                if (!issue) {
                  return null;
                }
                return (
                  <Card key={order.id}>
                    <CardHeader>
                      <CardTitle>{order.name}</CardTitle>
                      <div className="space-y-2">
                        <CardDescription className="flex items-center gap-2">
                          {dayjs(order.createdAt).format("MMM DD, YYYY")}
                          {order.displayDestinationCountryCode &&
                            order.displayDestinationCountryName && (
                              <CountryFlag
                                countryCode={
                                  order.displayDestinationCountryCode
                                }
                                countryName={
                                  order.displayDestinationCountryName
                                }
                              />
                            )}
                        </CardDescription>
                        <div className="text-sm text-red-600">
                          Issue: {issue.label}
                        </div>
                      </div>
                      <CardAction className="flex items-center gap-2">
                        <Link href={`/orders/${parseGid(order.id)}?from=session&session_id=${session.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          View Order
                        </Link>
                        <Button
                          variant="fill"
                          onClick={() => addHold(order.id, issue.label)}
                          loading={addHoldMutation.isPending && addHoldMutation.variables?.orderId === order.id}
                        >
                          Add Hold
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      {order.shipments.map((shipment) => {
                        return (
                          <div key={shipment.id}>
                            <div className="flex items-center gap-2 text-sm">
                              <ShippingAPI api={shipment.api} />
                              <div className="text-muted-foreground">
                                {dayjs(shipment.createdAt).format(
                                  "MMM DD, YYYY HH:mm a",
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2">
                              <div className="flex items-center gap-2">
                                {shipment.chosenCarrierName ? (
                                  <Image
                                    className="w-5"
                                    src={
                                      getCarrierImage(
                                        shipment.chosenCarrierName,
                                      ) || ""
                                    }
                                    alt={shipment.chosenCarrierName}
                                    width={100}
                                    height={100}
                                  />
                                ) : (
                                  <Icon
                                    icon="ph:truck"
                                    className="size-5 text-zinc-500"
                                  />
                                )}
                                <div>
                                  <div className="font-semibold text-sm">
                                    {shipment.chosenCarrierName}
                                  </div>
                                  <div className="text-sm">
                                    <span>${shipment.cost}</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                {shipment.isPurchased ? (
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                      <Icon
                                        icon="ph:tag"
                                        className="text-zinc-700 size-3"
                                      />
                                      <div className="text-sm text-zinc-500">
                                        Purchased
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-4">
                              {shipment.isRefunded && (
                                <Alert
                                  variant="default"
                                  className="text-red-600 mt-4"
                                >
                                  <Icon icon="ph:info" />
                                  <AlertTitle>Shipment is refunded</AlertTitle>
                                  <AlertDescription>
                                    This shipment was refunded
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
              <div className="h-28" />
            </div>
          ) : (
            <div className="py-8 text-sm flex items-center justify-center bg-zinc-50 text-center text-emerald-700">
              <div className="flex items-center gap-2">
                <Icon icon="ph:check-circle" className="text-inherit" />
                No shipping issues found.
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="border-t">
          <Button
            disabled={Boolean(session.shipmentsVerifiedAt)}
            onClick={verifyShipments}
            loading={verifyShipmentsMutation.isPending}
          >
            Mark as Verified
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
