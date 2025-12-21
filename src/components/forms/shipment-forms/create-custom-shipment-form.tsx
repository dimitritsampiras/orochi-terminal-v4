"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import { parseGid } from "@/lib/utils";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { shipmentApi } from "@drizzle/schema";
import { GeneralParcel } from "@/lib/core/shipping/parcel-schema";
import { OrderQuery } from "@/lib/types/admin.generated";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { CreateShipmentSchema, GetRatesSchema } from "@/lib/schemas/order-schema";
import { Card } from "@/components/ui/card";
import { CreateShipmentResponse, GetRateResponse } from "@/lib/types/api";
import { NormalizedShipmentRate } from "@/lib/types/shipping.types";
import Image from "next/image";
import { ShippingAPI } from "@/components/cards/shipping-info";

type Step = "select-items" | "select-rate";

type LineItem = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>["lineItems"]["nodes"][number];

interface CreateCustomShipmentFormProps {
  orderId: string;
  lineItems: Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>["lineItems"]["nodes"];
}

export const CreateCustomShipmentForm = ({ orderId, lineItems }: CreateCustomShipmentFormProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select-items");
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<string[]>([]);
  const [ratesData, setRatesData] = useState<GetRateResponse["data"]>(null);
  const [selectedRate, setSelectedRate] = useState<NormalizedShipmentRate | null>(null);

  const { trigger: fetchRates, isLoading: isFetchingRates } = useFetcher<GetRatesSchema, GetRateResponse>({
    path: `/api/orders/${parseGid(orderId)}/rates`,
    method: "POST",
    successMessage: "Rates fetched successfully",
    errorMessage: "Failed to fetch rates",
    onSuccess: ({ data }) => {
      if (data) {
        setRatesData(data);
        setStep("select-rate");
      }
    },
  });

  const { trigger: createShipment, isLoading: isCreatingShipment } = useFetcher<
    CreateShipmentSchema,
    CreateShipmentResponse
  >({
    path: `/api/orders/${parseGid(orderId)}/shipments`,
    method: "POST",
    successMessage: "Shipment created successfully",
    errorMessage: "Failed to create shipment",
    onSuccess: ({ data }) => {
      if (data) {
        setOpen(false);
      }
    },
  });

  // Filter to only shippable, unfulfilled items
  const shippableItems = lineItems.filter((item) => item.requiresShipping);

  const toggleLineItem = (id: string) => {
    setSelectedLineItemIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectAll = () => {
    setSelectedLineItemIds(shippableItems.map((item) => item.id));
  };

  const clearSelection = () => {
    setSelectedLineItemIds([]);
  };

  const resetForm = () => {
    setStep("select-items");
    setSelectedLineItemIds([]);
    // setRatesData(null);
    // setSelectedRate(null);
  };

  const goBackToItems = () => {
    setStep("select-items");
    // setRatesData(null);
    // setSelectedRate(null);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="fill" size="icon">
          <Icon icon="ph:plus" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create Custom Shipment</SheetTitle>
          <SheetDescription>
            {step === "select-items" && "Select the items you want to include in this shipment"}
            {step === "select-rate" && "Choose a shipping rate for your shipment"}
          </SheetDescription>
        </SheetHeader>

        {/* Step Content */}

        {step === "select-items" && (
          <>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-4 pb-2">
                <div className="text-sm text-muted-foreground">
                  {selectedLineItemIds.length} of {shippableItems.length} selected
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedLineItemIds.length === 0}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    disabled={selectedLineItemIds.length === shippableItems.length}
                  >
                    Select All
                  </Button>
                </div>
              </div>
              <ScrollArea className="px-4 h-full">
                <div className="space-y-2 pb-4">
                  {shippableItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No shippable items available</div>
                  ) : (
                    shippableItems.map((item) => (
                      <LineItemCard
                        key={item.id}
                        item={item}
                        selected={selectedLineItemIds.includes(item.id)}
                        onToggle={() => toggleLineItem(item.id)}
                      />
                    ))
                  )}
                </div>
                <div className="h-[400px]"></div>
              </ScrollArea>
            </div>
            <SheetFooter className="border-t absolute bottom-0 left-0 right-0 bg-white">
              <Button
                disabled={selectedLineItemIds.length === 0}
                loading={isFetchingRates}
                variant="outline"
                onClick={async () => {
                  await fetchRates({ lineItemIds: selectedLineItemIds });
                }}
              >
                Next
                <Icon icon="ph:arrow-right" />
              </Button>
            </SheetFooter>
          </>
        )}

        {step === "select-rate" && ratesData && (
          <>
            <div className="flex flex-col h-full">
              <div className="px-4 pb-2">
                <Button variant="ghost" size="sm" onClick={goBackToItems} className="text-muted-foreground">
                  <Icon icon="ph:arrow-left" />
                  Change Items
                </Button>
              </div>

              {/* Parcel Summary */}
              <div className="px-4 pb-3">
                <div className="bg-zinc-50 rounded-lg p-3 text-sm">
                  <div className="font-medium mb-1">Parcel Summary</div>
                  <div className="text-muted-foreground text-xs grid grid-cols-2 gap-1">
                    <span>Weight: {ratesData.parcel.totalWeight.toFixed(2)} oz</span>
                    <span>Items: {ratesData.parcel.items.length}</span>
                    <span>Template: {ratesData.parcel.parcelTemplate.name}</span>
                    <span>Value: ${ratesData.parcel.totalValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <ScrollArea className="px-4 h-full">
                <div className="space-y-2 pb-4">
                  {ratesData.otherRates.map((rate) => (
                    <RateCard
                      key={rate.rateId}
                      rate={rate}
                      isRecommended={ratesData.rate.rateId === rate.rateId}
                      selected={selectedRate?.rateId === rate.rateId}
                      onSelect={() => {
                        if (selectedRate?.rateId === rate.rateId) {
                          setSelectedRate(null);
                        } else {
                          setSelectedRate(rate);
                        }
                      }}
                    />
                  ))}
                </div>
                <div className="h-[400px]"></div>
              </ScrollArea>
            </div>
            <SheetFooter className="border-t absolute bottom-0 left-0 right-0 bg-white">
              <Button
                disabled={!selectedRate}
                loading={isCreatingShipment}
                onClick={async () => {
                  if (!selectedRate || !ratesData) return;
                  await createShipment({
                    customShipment: {
                      rate: selectedRate,
                      parcel: ratesData.parcel,
                    },
                  });
                }}
              >
                Create Shipment
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

const LineItemCard = ({ item, selected, onToggle }: { item: LineItem; selected: boolean; onToggle: () => void }) => {
  return (
    <Card
      className={cn(
        "w-full justify-start h-fit py-2 transition-all duration-200 px-3 gap-2 opacity-50 bg-zinc-100! flex flex-row items-center shadow-xs",
        selected && "opacity-100 bg-white!"
      )}
      onClick={onToggle}
    >
      <Checkbox checked={selected} onCheckedChange={onToggle} onClick={(e) => e.stopPropagation()} />
      {item.image?.url && (
        <img src={item.image.url} alt={item.title} className="w-10 h-10 rounded-md object-cover border" />
      )}
      <div className="flex-1 text-left min-w-0">
        <div className="font-medium text-sm truncate">{item.title}</div>
        {item.variantTitle && <div className="text-xs truncate">{item.variantTitle}</div>}
      </div>
      <div className="text-sm text-muted-foreground">×{item.quantity}</div>
    </Card>
  );
};

const RateCard = ({
  rate,
  isRecommended,
  selected,
  onSelect,
}: {
  rate: NormalizedShipmentRate;
  isRecommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) => {
  return (
    <Card
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-colors w-full hover:bg-zinc-50",
        selected ? "border-primary bg-primary/5" : "border-zinc-200 hover:border-zinc-300"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {rate.carrierLogo ? (
              <Image className="w-5" src={rate.carrierLogo} alt={rate.carrierName} width={100} height={100} />
            ) : (
              <Icon icon="ph:truck" className="size-5 text-zinc-500" />
            )}
            <div>
              <div className="font-semibold text-sm">
                {rate.carrierName}{" "}
                <span className="capitalize">{rate.serviceName?.toLowerCase().replaceAll("_", " ")}</span>
              </div>
              <div className="text-sm">
                <span>${rate.cost.toFixed(2)}</span>
                {rate.eta !== null && rate.eta !== undefined ? (
                  <>
                    {" "}
                    • <span className="text-zinc-500">{`${rate.eta}`} days</span>
                  </>
                ) : (
                  <span className="text-zinc-400 inline-block ml-1">• unknown eta</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <ShippingAPI api={rate.api} className="text-xs" />
        </div>
      </div>
    </Card>
  );
};
