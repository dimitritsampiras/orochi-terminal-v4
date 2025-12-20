"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/utils";
import { shipmentApi } from "@drizzle/schema";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { toast } from "sonner";
import { OrderShipmentData } from "@/lib/core/shipping/retrieve-shipments-from-order";
import dayjs from "dayjs";
import { AutoCreateShipmentForm } from "../forms/shipment-forms/auto-create-shipment-form";
import Image from "next/image";
import { PurchaseShipmentForm } from "../forms/shipment-forms/purchase-shipment-form";
import { DeleteShipmentForm } from "../forms/shipment-forms/delete-shipment-form";
import { ShippoTrackingStatusBadge } from "../badges/shippo-tracking-status-badge";

// Normalized shipment data for unified rendering
interface NormalizedShipmentDisplay {
  id: string;
  orderId: string;
  api: (typeof shipmentApi)["enumValues"][number];
  createdAt: Date;
  isPurchased: boolean;
  // Rate info
  carrierLogo: string | null;
  carrierName: string;
  serviceName: string;
  amount: string;
  estimatedDays: number | null;
  labelSlipPath: string | null;
  plainSlipPath: string | null;

  // Tracking info (only present if purchased)
  tracking: {
    number: string;
    url: string | null;
    status: string | null;
  } | null;
}

// Normalizer function to transform API-specific data into a common format
function normalizeShipmentData(shipment: OrderShipmentData): NormalizedShipmentDisplay | null {
  if (shipment.api === "SHIPPO") {
    const rate = shipment.shippoInfo.rates.find((r) => r.objectId === shipment.chosenRateId);
    if (!rate) return null;

    const transaction = shipment.shippoInfo.transaction;

    return {
      id: shipment.id,
      orderId: shipment.orderId,
      api: "SHIPPO",
      createdAt: shipment.createdAt,
      isPurchased: shipment.isPurchased,
      carrierLogo: rate.providerImage200 ?? null,
      carrierName: rate.provider,
      serviceName: rate.servicelevel.name || rate.servicelevel.token || "",
      amount: rate.amount,
      estimatedDays: rate.estimatedDays ?? null,
      labelSlipPath: shipment.labelSlipPath,
      plainSlipPath: shipment.plainSlipPath,
      tracking: transaction
        ? {
            number: transaction.trackingNumber || "",
            url: transaction.trackingUrlProvider ?? null,
            status: transaction.trackingStatus ?? null,
          }
        : null,
    };
  }

  if (shipment.api === "EASYPOST") {
    const rate = shipment.easypostInfo.chosenRate;
    if (!rate) return null;

    const hasTracking = !!shipment.easypostInfo.tracking_code;

    return {
      id: shipment.id,
      orderId: shipment.orderId,
      api: "EASYPOST",
      createdAt: shipment.createdAt,
      isPurchased: shipment.isPurchased,
      carrierLogo: null, // EasyPost doesn't provide carrier logos
      carrierName: rate.carrier,
      serviceName: rate.service,
      amount: rate.rate,
      estimatedDays: rate.delivery_days ?? null,
      labelSlipPath: shipment.labelSlipPath,
      plainSlipPath: shipment.plainSlipPath,
      tracking: hasTracking
        ? {
            number: shipment.easypostInfo.tracking_code,
            url: shipment.easypostInfo.tracker?.public_url ?? null,
            status: shipment.easypostInfo.status ?? null,
          }
        : null,
    };
  }

  return null;
}

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
        {orderShipmentData.map((orderShipment) => {
          const normalized = normalizeShipmentData(orderShipment);
          if (!normalized) return null;
          return <ShipmentCard key={normalized.id} shipment={normalized} />;
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

// Unified shipment card component that works with both Shippo and EasyPost
const ShipmentCard = ({ shipment }: { shipment: NormalizedShipmentDisplay }) => {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <ShippingAPI api={shipment.api} />
        <div className="text-muted-foreground">{dayjs(shipment.createdAt).format("MMM DD, YYYY HH:mm a")}</div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          {shipment.carrierLogo ? (
            <Image className="w-5" src={shipment.carrierLogo} alt={shipment.carrierName} width={100} height={100} />
          ) : (
            <Icon icon="ph:truck" className="size-5 text-zinc-500" />
          )}
          <div>
            <div className="font-semibold text-sm">
              {shipment.carrierName} {shipment.serviceName}
            </div>
            <div className="text-sm">
              <span>${shipment.amount}</span>
              {shipment.estimatedDays !== null && (
                <>
                  {" "}
                  • <span className="text-zinc-500">{shipment.estimatedDays} days</span>
                </>
              )}
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
            <div className="flex items-center gap-2">
              <PurchaseShipmentForm databaseShipmentUUID={shipment.id} orderId={shipment.orderId} />
              <DeleteShipmentForm shipmentId={shipment.id} orderId={shipment.orderId} />
            </div>
          )}
        </div>
      </div>
      {shipment.tracking && (
        <div className="mt-4 text-sm flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold">Tracking Number: </div>
            <div
              className="hover:opacity-50 transition-opacity hover:cursor-pointer flex items-center gap-1"
              onClick={() => {
                navigator.clipboard.writeText(shipment.tracking?.number || "");
                toast.success("Tracking number copied to clipboard");
              }}
            >
              {shipment.tracking.number}
              <Icon icon="ph:copy" className="size-3 inline" />
            </div>
          </div>
          {shipment.tracking.url && (
            <div className="flex items-center gap-2">
              <div className="font-semibold">Tracking Link: </div>
              <Link
                href={shipment.tracking.url}
                target="_blank"
                className="hover:opacity-50 transition-opacity hover:cursor-pointer"
              >
                {shipment.tracking.url.replace(/^(https?:\/\/[^/]+).*$/, "$1/...")}
              </Link>
            </div>
          )}
          {shipment.tracking.status && (
            <div className="flex items-center gap-2">
              <div className="font-semibold">Tracking Status: </div>
              <TrackingStatusBadge status={shipment.tracking.status} api={shipment.api} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Unified tracking status badge that handles both API formats
const TrackingStatusBadge = ({ status, api }: { status: string; api: (typeof shipmentApi)["enumValues"][number] }) => {
  // For Shippo, use the existing badge component
  if (api === "SHIPPO") {
    // Cast to Shippo's tracking status type (the normalizer ensures valid values)
    return <ShippoTrackingStatusBadge status={status as Parameters<typeof ShippoTrackingStatusBadge>[0]["status"]} />;
  }

  // For EasyPost, render a simple badge (can be expanded later)
  return <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium">{status}</span>;
};

export const ShippingAPI = ({ api }: { api: (typeof shipmentApi)["enumValues"][number] }) => {
  const styles: Record<(typeof shipmentApi.enumValues)[number], string> = {
    SHIPPO: "text-green-700",
    EASYPOST: "text-blue-700",
  };
  return <div className={cn(styles[api], "font-semibold uppercase text-sm")}>{api}</div>;
};
