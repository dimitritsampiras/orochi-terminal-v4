"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { lineItemCompletionStatus, lineItems, shipmentApi } from "@drizzle/schema";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { SetLineItemStatusForm } from "../forms/order-forms/set-line-item-status-form";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { LineItemStatusBadge } from "../badges/line-item-status-badge";
import {
  type EasyPostShipmentData,
  OrderShipmentData,
  type ShippoShipmentData,
} from "@/lib/core/shipping/retrieve-shipments-from-order";
import dayjs from "dayjs";
import { AutoCreateShipmentForm } from "../forms/shipment-forms/auto-create-shipment-form";
import Image from "next/image";
import { PurchaseShipmentForm } from "../forms/shipment-forms/purchase-shipment-form";
import { ShippoTrackingStatusBadge } from "../badges/shippo-tracking-status-badge";

// Types

interface ShippingInfoProps {
  orderId: string;
  orderShipmentData: OrderShipmentData[];
}

export function ShippingInfo({ orderId, orderShipmentData }: ShippingInfoProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Shipping Info</CardTitle>
          <div className="flex items-center gap-2">
            <AutoCreateShipmentForm orderId={orderId} />
            <Button variant="outline" className="bg-white!" size="icon">
              <Icon icon="ph:arrow-right" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {orderShipmentData.length >= 0 &&
          orderShipmentData.map((orderShipment) => {
            if (orderShipment.api === "SHIPPO") {
              return <ShippoShipmentData key={orderShipment.id} shipment={orderShipment} />;
            } else if (orderShipment.api === "EASYPOST") {
              return <EasyPostShipmentData key={orderShipment.id} shipment={orderShipment} />;
            }
            return null;
          })}
        {orderShipmentData.length === 0 && (
          <div className="text-center bg-zinc-50 rounded-lg text-sm py-4 text-gray-500">
            <div className="flex items-center gap-2 justify-center">
              <Icon icon="ph:package" className="text-zinc-400" />
              <div>No shipments yet</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ShippoShipmentData = ({ shipment }: { shipment: ShippoShipmentData }) => {
  const rate = shipment.shippoInfo.rates.find((rate) => rate.objectId === shipment.chosenRateId);

  if (!rate) {
    return null;
  }

  const carrierLogo = rate.providerImage200 ?? rate.provider;
  const carrierName = rate.provider;
  const service = rate.servicelevel.name || rate.servicelevel.token || "";

  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <ShippingAPI api={shipment.api} />
        <div className="text-muted-foreground">{dayjs(shipment.createdAt).format("MMM DD, YYYY HH:mm a")}</div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          <Image className="w-5" src={carrierLogo} alt={rate.provider} width={100} height={100} />
          <div>
            <div className="font-semibold text-sm">
              {carrierName} {service}
            </div>
            <div className="text-sm">
              <span>${rate.amount}</span> • <span className="text-zinc-500">{rate.estimatedDays} days</span>
            </div>
          </div>
        </div>
        <div>
          {shipment.isPurchased ? (
            <div className="flex items-center gap-2">
              <Icon icon="ph:tag" className="text-zinc-700 size-3" />
              <div className="text-sm text-zinc-500">Purchased</div>
            </div>
          ) : (
            <PurchaseShipmentForm databaseShipmentUUID={shipment.id} orderId={shipment.orderId} />
          )}
        </div>
      </div>
      {shipment.shippoInfo.transaction && (
        <div className="mt-4 text-sm flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Tracking Number: </div>
            <div
              className="hover:opacity-50 transition-opacity hover:cursor-pointer flex items-center gap-1"
              onClick={() => {
                navigator.clipboard.writeText(shipment.shippoInfo.transaction?.trackingNumber || "");
                toast.success("Tracking number copied to clipboard");
              }}
            >
              {shipment.shippoInfo.transaction.trackingNumber}
              <Icon icon="ph:copy" className="size-3 inline" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-semibold">Tracking Link: </div>
            <Link
              href={shipment.shippoInfo.transaction.trackingUrlProvider ?? "#"}
              target="_blank"
              className="hover:opacity-50 transition-opacity hover:cursor-pointer"
            >
              {shipment.shippoInfo.transaction.trackingUrlProvider
                ? shipment.shippoInfo.transaction.trackingUrlProvider.replace(/^(https?:\/\/[^/]+).*$/, "$1/...")
                : ""}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-semibold">Tracking Status: </div>
            <ShippoTrackingStatusBadge status={shipment.shippoInfo.transaction.trackingStatus} />
          </div>
        </div>
      )}
    </div>
  );
};

const EasyPostShipmentData = ({ shipment }: { shipment: EasyPostShipmentData }) => {
  return (
    <div>
      <div className="flex items-center justify-center gap-2 text-sm">
        <div>{dayjs(shipment.createdAt).format("MMM DD, YYYY HH:mm a")}</div>
        <ShippingAPI api={shipment.api} />
      </div>
    </div>
  );
};

export const ShippingAPI = ({ api }: { api: (typeof shipmentApi)["enumValues"][number] }) => {
  const styles: Record<(typeof shipmentApi.enumValues)[number], string> = {
    SHIPPO: "text-green-700",
    EASYPOST: "text-blue-700",
  };
  return <div className={cn(styles[api], "font-semibold uppercase text-sm")}>{api}</div>;
};
