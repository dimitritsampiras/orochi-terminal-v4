"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

import { cn, getCarrierImage } from "@/lib/utils";
import { shipmentApi } from "@drizzle/schema";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { toast } from "sonner";
import { OrderShipmentData } from "@/lib/core/shipping/retrieve-shipments-from-order";
import { generalParcelSchema } from "@/lib/core/shipping/parcel-schema";
import { OrderQuery } from "@/lib/types/admin.generated";
import dayjs from "dayjs";
import { AutoCreateShipmentForm } from "../forms/shipment-forms/auto-create-shipment-form";
import { CreateCustomShipmentForm } from "../forms/shipment-forms/create-custom-shipment-form";
import Image from "next/image";
import { PurchaseShipmentForm } from "../forms/shipment-forms/purchase-shipment-form";
import { DeleteShipmentForm } from "../forms/shipment-forms/delete-shipment-form";
import { RefundShipmentForm } from "../forms/shipment-forms/refund-shipment-form";
import { EasyPostTrackingStatusBadge, ShippoTrackingStatusBadge } from "../badges/tracking-status-badge";
import { IdCopyBadge } from "../badges/id-copy-badge";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const PACKING_SLIPS_BASE_URL = "https://muihkdbhpgfkahlyyhmo.supabase.co/storage/v1/object/public/packing-slips";

// Types
type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;
type OrderLineItem = Order["lineItems"]["nodes"][number];

type ShipmentMessage = { source: string; text: string };

// Normalized shipment data for unified rendering
interface NormalizedShipmentDisplay {
  id: string;
  orderId: string;
  api: (typeof shipmentApi)["enumValues"][number];
  createdAt: Date;
  isPurchased: boolean;
  isRefunded: boolean;
  // Rate info
  rateInfo: {
    carrierLogo: string | null;
    carrierName: string;
    serviceName: string;
    amount: string;
    estimatedDays: number | null;
  };
  labelSlipURL: string | null;
  plainSlipURL: string | null;
  // For details sheet
  apiShipmentId: string;
  lineItemIds: string[] | null;
  parcelSnapshot: unknown;
  messages: ShipmentMessage[];
  gateScannedAt: Date | null;
  gateScannerBy: string | null;
  // Tracking info (only present if purchased)
  tracking: {
    number: string;
    url: string | null;
    status: string | null;
    labelURL: string | null;
  } | null;
}

// Normalizer function to transform API-specific data into a common format
function normalizeShipmentData(shipment: OrderShipmentData): NormalizedShipmentDisplay | null {
  if (shipment.api === "SHIPPO") {
    const rate = shipment.shippoInfo.rates.find((r) => r.objectId === shipment.chosenRateId);

    // if (!rate) return null;

    const transaction = shipment.shippoInfo.transaction;

    // Extract messages
    const messages: ShipmentMessage[] = [];
    for (const msg of shipment.shippoInfo.messages ?? []) {
      messages.push({ source: msg.source ?? "Shippo", text: msg.text ?? "" });
    }
    for (const issue of shipment.shippoInfo.issues) {
      messages.push({ source: "System", text: issue });
    }

    return {
      id: shipment.id,
      orderId: shipment.orderId,
      api: "SHIPPO",
      createdAt: shipment.createdAt,
      isPurchased: shipment.isPurchased,
      isRefunded: shipment.isRefunded ?? false,
      gateScannedAt: shipment.gateScannedAt,
      gateScannerBy: shipment.gateScannerBy,
      rateInfo: {
        carrierLogo:
          rate?.providerImage200 ||
          getCarrierImage(shipment.shippoInfo.chosenRate?.provider || shipment.chosenCarrierName || "") ||
          null,
        carrierName: rate?.provider || shipment.shippoInfo.chosenRate?.provider || shipment.chosenCarrierName || "???",
        serviceName: rate?.servicelevel.name || shipment.shippoInfo.chosenRate?.servicelevel.name || "???",
        amount: rate?.amount || shipment.cost || "???",
        estimatedDays: rate?.estimatedDays ?? null,
      },
      labelSlipURL: shipment.labelSlipPath ? `${PACKING_SLIPS_BASE_URL}/${shipment.labelSlipPath}` : null,
      plainSlipURL: shipment.plainSlipPath ? `${PACKING_SLIPS_BASE_URL}/${shipment.plainSlipPath}` : null,
      apiShipmentId: shipment.shipmentId,
      lineItemIds: shipment.lineItemIds,
      parcelSnapshot: shipment.parcelSnapshot,
      messages,
      tracking: transaction
        ? {
            number: transaction.trackingNumber || "",
            url: transaction.trackingUrlProvider ?? null,
            status: transaction.trackingStatus ?? null,
            labelURL: transaction.labelUrl ?? null,
          }
        : null,
    };
  }

  if (shipment.api === "EASYPOST") {
    const rate = shipment.easypostInfo.chosenRate;

    const hasTracking = !!shipment.easypostInfo.tracking_code;

    // Extract messages
    const messages: ShipmentMessage[] = [];
    for (const msg of shipment.easypostInfo.messages ?? []) {
      messages.push({ source: msg.carrier ?? "EasyPost", text: msg.message ?? "" });
    }
    for (const issue of shipment.easypostInfo.issues) {
      messages.push({ source: "System", text: issue });
    }

    return {
      id: shipment.id,
      orderId: shipment.orderId,
      api: "EASYPOST",
      createdAt: shipment.createdAt,
      isPurchased: shipment.isPurchased,
      isRefunded: shipment.isRefunded ?? false,
      gateScannedAt: shipment.gateScannedAt,
      gateScannerBy: shipment.gateScannerBy,
      rateInfo: {
        carrierLogo:
          getCarrierImage(shipment.easypostInfo.chosenRate?.carrier || shipment.chosenCarrierName || "") || null,
        carrierName: shipment.easypostInfo.chosenRate?.carrier || shipment.chosenCarrierName || "???",
        serviceName: shipment.easypostInfo.chosenRate?.service || "???",
        amount: shipment.easypostInfo.chosenRate?.rate || shipment.cost || "???",
        estimatedDays: shipment.easypostInfo.chosenRate?.delivery_days ?? null,
      },
      labelSlipURL: shipment.labelSlipPath ? `${PACKING_SLIPS_BASE_URL}/${shipment.labelSlipPath}` : null,
      plainSlipURL: shipment.plainSlipPath ? `${PACKING_SLIPS_BASE_URL}/${shipment.plainSlipPath}` : null,
      apiShipmentId: shipment.shipmentId,
      lineItemIds: shipment.lineItemIds,
      parcelSnapshot: shipment.parcelSnapshot,
      messages,
      tracking: hasTracking
        ? {
            number: shipment.easypostInfo.tracking_code,
            url: shipment.easypostInfo.tracker?.public_url ?? null,
            status: shipment.easypostInfo.status ?? null,
            labelURL: shipment.easypostInfo.postage_label.label_url ?? null,
          }
        : null,
    };
  }

  return null;
}

interface ShippingInfoProps {
  orderId: string;
  orderShipmentData: OrderShipmentData[];
  lineItems?: OrderLineItem[];
}

export function ShippingInfo({ orderId, orderShipmentData, lineItems = [] }: ShippingInfoProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Shipping Info</CardTitle>
          <div className="flex items-center gap-2">
            <AutoCreateShipmentForm orderId={orderId} />
            <CreateCustomShipmentForm orderId={orderId} lineItems={lineItems} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {orderShipmentData.map((orderShipment, idx) => {
          const shipment = normalizeShipmentData(orderShipment);
          if (!shipment) return null;
          return (
            <div key={shipment.id}>
              <ShipmentCard shipment={shipment} lineItems={lineItems} />
              {idx < orderShipmentData.length - 1 && <hr className="mt-8 mb-4" />}
            </div>
          );
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

// Shipment Card
const ShipmentCard = ({ shipment, lineItems }: { shipment: NormalizedShipmentDisplay; lineItems: OrderLineItem[] }) => {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm">
        <IdCopyBadge id={shipment.id} iconOnly />
        <ShippingAPI api={shipment.api} />
        <div className="text-muted-foreground">{dayjs(shipment.createdAt).format("MMM DD, YYYY HH:mm a")}</div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          {shipment.rateInfo?.carrierLogo ? (
            <Image
              className="w-5"
              src={shipment.rateInfo.carrierLogo}
              alt={shipment.rateInfo.carrierName}
              width={100}
              height={100}
            />
          ) : (
            <Icon icon="ph:truck" className="size-5 text-zinc-500" />
          )}
          <div>
            <div className="font-semibold text-sm">
              {shipment.rateInfo?.carrierName} {shipment.rateInfo?.serviceName}
            </div>
            <div className="text-sm">
              <span>${shipment.rateInfo?.amount}</span>
              {shipment.rateInfo.estimatedDays !== null && (
                <>
                  {" "}
                  • <span className="text-zinc-500">{shipment.rateInfo.estimatedDays} days</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div>
          {shipment.isPurchased ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Icon icon="ph:tag" className="text-zinc-700 size-3" />
                <div className="text-sm text-zinc-500">Purchased</div>
              </div>
              <ShipmentDetailsSheet shipment={shipment} lineItems={lineItems} smallIcon />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <PurchaseShipmentForm databaseShipmentUUID={shipment.id} orderId={shipment.orderId} />
              <ShipmentDetailsSheet shipment={shipment} lineItems={lineItems} />
              <DeleteShipmentForm shipmentId={shipment.id} orderId={shipment.orderId} />
            </div>
          )}
        </div>
      </div>
      {shipment.tracking && (
        <div className="mt-4">
          <div className="text-sm flex flex-col gap-1">
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

            <hr className="my-2 w-10" />
            <div className="flex items-center gap-2">
              <div className="font-semibold">Shipment Scanned: </div>
              {shipment.gateScannedAt ? (
                <Badge className="text-zinc-700 gap-2" variant="outline">
                  <div className="min-w-1.5 min-h-1.5 rounded-full bg-red-600"></div>
                  <div className="text-xs">
                    <span className="text-zinc-700 font-semibold">Scanned: </span>
                    <span className="text-zinc-500">
                      {" "}
                      {dayjs(shipment.gateScannedAt).format("MMM DD, YYYY hh:mm a")}
                    </span>
                  </div>
                </Badge>
              ) : (
                <Badge className="text-zinc-700 gap-2" variant="outline">
                  <div className="min-w-1.5 min-h-1.5 rounded-full bg-zinc-400"></div>
                  <div className="text-xs">
                    <span className="text-zinc-500">Not scanned</span>
                  </div>
                </Badge>
              )}
            </div>
          </div>
          {!shipment.isRefunded ? (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center">
                <RefundShipmentForm shipmentId={shipment.id} orderId={shipment.orderId} />
              </div>
              <div className="flex items-center gap-2">
                <Tooltip open={shipment.plainSlipURL ? false : undefined}>
                  <TooltipTrigger asChild>
                    <Link
                      href={shipment.plainSlipURL ?? "#"}
                      target="_blank"
                      className={buttonVariants({
                        variant: "outline",
                        size: "icon",
                        className: !shipment.plainSlipURL ? "opacity-50 cursor-not-allowed" : "",
                      })}
                      onClick={(e) => {
                        if (!shipment.plainSlipURL) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <Icon icon="ph:file" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Packing slip filed to generate</TooltipContent>
                </Tooltip>
                <Link
                  aria-disabled={!shipment.tracking.labelURL}
                  href={shipment.tracking.labelURL ?? "#"}
                  target="_blank"
                  className={buttonVariants({
                    variant: "fill",
                    size: "icon",
                    className: !shipment.tracking.labelURL ? "opacity-50 cursor-not-allowed" : "",
                  })}
                  onClick={(e) => {
                    if (!shipment.tracking?.labelURL) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Icon icon="ph:receipt" />
                </Link>
                <Tooltip open={shipment.labelSlipURL ? false : undefined}>
                  <TooltipTrigger asChild>
                    <Link
                      aria-disabled={!shipment.labelSlipURL}
                      href={shipment.labelSlipURL ?? "#"}
                      target="_blank"
                      className={buttonVariants({
                        className: !shipment.labelSlipURL ? "opacity-50 cursor-not-allowed" : "",
                      })}
                      onClick={(e) => {
                        if (!shipment.labelSlipURL) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Print Packing Slip
                      <Icon icon="ph:file-text" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Packing slip filed to generate</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            <Alert variant="default" className="text-red-600 mt-4">
              <Icon icon="ph:info" />
              <AlertTitle>Shipment is refunded</AlertTitle>
              <AlertDescription>This shipment was refunded</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

// Tracking Status Badge
const TrackingStatusBadge = ({ status, api }: { status: string; api: (typeof shipmentApi)["enumValues"][number] }) => {
  if (api === "SHIPPO") {
    return <ShippoTrackingStatusBadge status={status as Parameters<typeof ShippoTrackingStatusBadge>[0]["status"]} />;
  }
  if (api === "EASYPOST") {
    return <EasyPostTrackingStatusBadge status={status as Parameters<typeof EasyPostTrackingStatusBadge>[0]["status"]} />;
  }
  return <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium">{status}</span>;
};

// Shipment Details Sheet
const ShipmentDetailsSheet = ({
  shipment,
  lineItems,
  smallIcon = false,
}: {
  shipment: NormalizedShipmentDisplay;
  lineItems: OrderLineItem[];
  smallIcon?: boolean;
}) => {
  // Parse and validate parcel snapshot
  const parcelResult = generalParcelSchema.safeParse(shipment.parcelSnapshot);
  const parcel = parcelResult.success ? parcelResult.data : null;

  // Get line items included in this shipment
  const shipmentLineItemIds = shipment.lineItemIds ?? [];
  const includedLineItems = lineItems.filter((item) => shipmentLineItemIds.includes(item.id));
  const allItemsIncluded = shipmentLineItemIds.length === 0;

  // Which items to display
  const displayLineItems = allItemsIncluded ? lineItems : includedLineItems;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size={smallIcon ? "icon-sm" : "icon"}>
          <Icon icon="ph:eye" className={smallIcon ? "size-3" : "size-4"} />
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShippingAPI api={shipment.api} />
            Shipment Details
          </SheetTitle>
          <SheetDescription>
            Created {dayjs(shipment.createdAt).format("MMM DD, YYYY")} at {dayjs(shipment.createdAt).format("h:mm A")}
          </SheetDescription>
        </SheetHeader>

        {shipment.isRefunded && (
          <Alert variant="default" className="mx-4 text-red-600">
            <Icon icon="ph:info" />
            <AlertTitle>Shipment Refunded</AlertTitle>
            <AlertDescription>This shipment has been refunded</AlertDescription>
          </Alert>
        )}

        <div className="px-4 pb-6 space-y-6">
          {/* Rate Summary */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Rate</h3>
            <div className="bg-zinc-50 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                {shipment.rateInfo.carrierLogo ? (
                  <Image
                    className="w-5"
                    src={shipment.rateInfo.carrierLogo}
                    alt={shipment.rateInfo.carrierName}
                    width={100}
                    height={100}
                  />
                ) : (
                  <Icon icon="ph:truck" className="size-5 text-zinc-500" />
                )}
                <span className="font-medium">
                  {shipment.rateInfo.carrierName} {shipment.rateInfo.serviceName}
                </span>
              </div>
              <div className="text-sm text-zinc-600">
                ${shipment.rateInfo.amount}
                {shipment.rateInfo.estimatedDays !== null && ` • ${shipment.rateInfo.estimatedDays} days`}
              </div>
            </div>
          </section>

          {/* Line Items */}
          <section>
            <h3 className="text-sm font-semibold mb-2">
              Line Items {!allItemsIncluded && <span className="text-zinc-500 font-normal">(partial)</span>}
            </h3>
            {displayLineItems.length > 0 ? (
              <div className="space-y-2">
                {displayLineItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm bg-zinc-50 rounded-lg p-2">
                    <span className="truncate flex-1">{item.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      x{item.quantity}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500 bg-zinc-50 rounded-lg p-3">No line items specified</div>
            )}
          </section>

          {/* Parcel Snapshot */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Parcel Snapshot</h3>
            {parcel ? (
              <div className="bg-zinc-50 rounded-lg p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-zinc-500 text-xs">Weight</div>
                    <div className="font-medium">{parcel.totalWeight} oz</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-xs">Value</div>
                    <div className="font-medium">${parcel.totalValue}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-xs">Volume</div>
                    <div className="font-medium">{parcel.totalVolume}</div>
                  </div>
                </div>
                <div className="border-t pt-2">
                  <div className="text-zinc-500 text-xs mb-1">Template</div>
                  <div className="text-sm font-medium">{parcel.parcelTemplate.name}</div>
                  <div className="text-xs text-zinc-500">
                    {parcel.parcelTemplate.lengthCm} × {parcel.parcelTemplate.widthCm} ×{" "}
                    {parcel.parcelTemplate.heightCm} cm
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 flex items-center gap-2">
                <Icon icon="ph:warning" className="size-4" />
                Parcel data is malformed or missing
              </div>
            )}
          </section>

          {/* Messages */}
          {shipment.messages.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2">Messages</h3>
              <div className="space-y-3">
                {shipment.messages.map((msg, idx) => (
                  <div key={idx} className="px-2">
                    <div className="text-xs font-semibold">{msg.source}</div>
                    <div className="text-xs text-zinc-600">{msg.text}</div>
                    {idx < shipment.messages.length - 1 && <hr className="mt-3" />}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* IDs */}
          <section>
            <h3 className="text-sm font-semibold mb-2">IDs</h3>
            <div className="bg-zinc-50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Database ID</span>
                <IdCopyBadge id={shipment.id} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">API Shipment ID</span>
                <IdCopyBadge id={shipment.apiShipmentId} />
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const ShippingAPI = ({
  api,
  className,
}: {
  api: (typeof shipmentApi)["enumValues"][number];
  className?: string;
}) => {
  const styles: Record<(typeof shipmentApi.enumValues)[number], string> = {
    SHIPPO: "text-green-700",
    EASYPOST: "text-blue-700",
  };
  return <div className={cn(styles[api], "font-semibold uppercase text-sm", className)}>{api}</div>;
};
