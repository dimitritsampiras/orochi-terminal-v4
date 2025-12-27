"use client";

import { AssemblyLineItemWithPrintLogs, type AssemblyLineItem } from "@/lib/core/session/create-assembly-line";
import { BackButton } from "../nav/back-button";
import { useAssemblyNavigation } from "@/lib/stores";
import { useEffect, useMemo, useState } from "react";
import { GetAssemblyLineResponse } from "@/lib/types/api";
import { toast } from "sonner";
import Link from "next/link";
import { Button, buttonVariants } from "../ui/button";
import { Icon } from "@iconify/react";
import { cn, getProductDetailsForARXP, parseGid, standardizePrintOrder } from "@/lib/utils";
import { ProductMediaGrid, AssemblyLineMediaGrid } from "../cards/product-media";
import { Badge } from "../ui/badge";
import { OrderQuery } from "@/lib/types/admin.generated";
import { MediaImage } from "@/lib/types/misc";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useLocalServer } from "@/lib/hooks/use-local-server";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Kbd } from "../ui/kbd";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { FulfillmentStatusBadge } from "../badges/fulfillment-status-badge";
import { LineItemStatusBadge } from "../badges/line-item-status-badge";
import { lineItemCompletionStatus } from "@drizzle/schema";

type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;

export const AssemblyItemController = ({
  item,
  media,
  order,
}: {
  item: AssemblyLineItemWithPrintLogs;
  media: MediaImage[];
  order: Order | undefined;
}) => {
  const { getNavigation, setNavigation, items } = useAssemblyNavigation();
  const { prev, next, position } = getNavigation(item.id);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const shopifyLineItem = order?.lineItems.nodes.find((lineItem) => lineItem.id === item.id);

  const noSyncedPrints = item.prints.length === 0 && !Boolean(item.product?.isBlackLabel);
  const noSyncedBlank = !Boolean(item.product?.isBlackLabel) && !Boolean(item.blankVariant);

  useEffect(() => {
    setHasMounted(true); // Add this
  }, []);

  const hasNavigation = hasMounted && position !== null;

  // Fallback: if store doesn't have this item, fetch assembly line
  useEffect(() => {
    if (!hasNavigation) {
      setIsLoading(true);
      fetch(`/api/assembly`)
        .then((res) => res.json())
        .then(({ data, error }: GetAssemblyLineResponse) => {
          if (error || !data) {
            toast.error(error || "Cannot load navigation");
          } else {
            setNavigation(data.batchId, data.lineItems);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [item.id, hasNavigation, setNavigation]);

  return (
    <div>
      <div className="flex justify-between items-center">
        <div className="flex items-start gap-3">
          <BackButton href="/assembly" className="mt-1" />
          <div>
            <h1 className="page-title">
              {hasNavigation && `${position + 1}. `}
              {item.name}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              {hasNavigation && (
                <p className="text-sm text-muted-foreground">
                  {position + 1} of {items.length}
                </p>
              )}
              <LineItemStatusBadge status={item.completionStatus} />
            </div>
          </div>
        </div>

        {hasNavigation && (
          <div className="flex items-center gap-2">
            <NavButton direction="prev" item={prev} />
            <NavButton direction="next" item={next} />
          </div>
        )}
      </div>

      <div className="my-4 flex flex-col gap-2">
        {item.quantity > 1 && (
          <Alert className="text-amber-700 bg-amber-50">
            <Icon icon="ph:warning-circle" className="size-4" />
            <AlertTitle>Multiple line item quantity: {item.quantity}</AlertTitle>
            <AlertDescription>
              <p>
                This item has a quantity of {item.quantity}. The duplicate items need to be printed manually. Please
                ensure necessary stock levels are adjusted. You can print duplicate items{" "}
                <Link
                  href={`/products/${item.productId}`}
                  className="hover:underline inline! text-zinc-800 underline-offset-2"
                >
                  here
                </Link>
                .
              </p>
            </AlertDescription>
          </Alert>
        )}
        {(order?.displayFulfillmentStatus === "FULFILLED" || item.order.displayFulfillmentStatus === "FULFILLED") && (
          <Alert className="text-amber-700 bg-amber-50">
            <Icon icon="ph:warning-circle" className="size-4" />
            <AlertTitle>Order already fulfilled</AlertTitle>
            <AlertDescription>
              <p>
                This order has already been fulfilled. There should be no need to print this item unless specified
                otherwise
              </p>
            </AlertDescription>
          </Alert>
        )}

        {noSyncedPrints && (
          <Alert className="text-red-700 bg-red-50">
            <Icon icon="ph:warning-circle" className="size-4" />
            <AlertTitle>No synced prints</AlertTitle>
            <AlertDescription>
              <p>
                This item has no synced prints. Either declare how many prints it needs in the product page or set it as
                a black label item.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {(order?.cancelledAt || item.order.displayIsCancelled) && (
          <Alert className="text-red-700 bg-red-50">
            <Icon icon="ph:warning-circle" className="size-4" />
            <AlertTitle>Order cancelled</AlertTitle>
            <AlertDescription>
              <p>
                This order is marked as cancelled. There should be no need to print this item unless specified otherwise
              </p>
            </AlertDescription>
          </Alert>
        )}

        {noSyncedBlank && (
          <Alert className="text-red-700 bg-red-50">
            <Icon icon="ph:warning-circle" className="size-4" />
            <AlertTitle>No synced blank</AlertTitle>
            <AlertDescription>
              <p>
                This item has no synced blank. Inventory can not be tracked effectively. Please either declare a blank in the
                product page or set it as a black label item.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {shopifyLineItem && (
          <>
            {shopifyLineItem.unfulfilledQuantity <= 0 && (
              <Alert className="text-yellow-700 bg-yellow-50">
                <Icon icon="ph:warning-circle" className="size-4" />
                <AlertTitle>Line item is not fulfillable</AlertTitle>
                <AlertDescription>
                  <p>This line item is not fulfillable. The order has likely already been fulfilled or removed fr.</p>
                </AlertDescription>
              </Alert>
            )}

            {!shopifyLineItem.requiresShipping && (
              <Alert className="text-red-700 bg-red-50">
                <Icon icon="ph:warning-circle" className="size-4" />
                <AlertTitle>Line item is not shippable</AlertTitle>
                <AlertDescription>
                  <p>This line item is not something that will be shipped. It does not need to be printed.</p>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </div>
      <div className="mb-24 mt-2 grid-cols-[3fr_2fr] gap-4 md:grid">
        <div className="flex flex-col gap-4">
          <AssemblyLineMediaGrid
            media={media}
            firstId={
              order
                ? order?.lineItems.nodes.find((lineItem) => lineItem.id === item.id)?.image?.id || undefined
                : undefined
            }
          />
          <Prints item={item} />
        </div>
        <div>
          <OrderDetails order={order} dbOrder={item.order} currentLineItemId={item.id} />
        </div>
      </div>
    </div>
  );
};

const Prints = ({ item }: { item: AssemblyLineItemWithPrintLogs }) => {
  const { isConnected, config, checkFileExists } = useLocalServer();
  const printCount = item.prints.length;
  const prints = standardizePrintOrder(item.prints);
  const [fileExists, setFileExists] = useState<boolean | null>(null);

  // 1-2 prints: single row, 3-4 prints: 2x2 grid
  const useGrid = printCount > 2;
  const emptySlots = useGrid ? Math.max(0, 4 - printCount) : Math.max(0, 2 - printCount);

  const [selectedPrintId, setSelectedPrintId] = useState<string | null>(null);

  const itemAlreadyMarkedAsStatus = (
    ["printed", "in_stock", "oos_blank"] as (typeof lineItemCompletionStatus.enumValues)[number][]
  ).includes(item.completionStatus);

  const getPrintStatus = (printId: string) => {
    const printLog = item.printLogs.filter((log) => log.active).find((log) => log.printId === printId);

    return printLog?.active ? "printed" : "not printed";
  };

  function selectPrint(printId: string) {
    if (getPrintStatus(printId) === "printed") return;
    if (selectedPrintId === printId) {
      setSelectedPrintId(null);
      return;
    }
    setSelectedPrintId(printId);
  }

  const arxpDetails = useMemo(() => {
    const printIndex = selectedPrintId ? prints.findIndex((print) => print.id === selectedPrintId) : -1;
    // const printIndex = selectedPrint ? prints.findIndex((print) => print.id === selectedPrint.id) : -1;
    if (printIndex === -1) {
      return null;
    }

    const details =
      item.product && item.productVariant
        ? getProductDetailsForARXP(item.product, item.productVariant, printIndex)
        : null;

    return details;
  }, [selectedPrintId, item.product, item.productVariant]);

  useEffect(() => {
    const verifyFile = async () => {
      if (!arxpDetails || !config.arxpFolderPath || !isConnected) {
        setFileExists(null);
        return;
      }

      try {
        const basePath = config.arxpFolderPath.replace(/\/$/, "");
        const fullPath = `${basePath}/${arxpDetails.path}`;
        const exists = await checkFileExists(fullPath);
        setFileExists(exists);
      } catch (e) {
        console.error("Failed to check file existence", e);
        setFileExists(false);
      }
    };

    verifyFile();
  }, [arxpDetails, config.arxpFolderPath, isConnected, checkFileExists]);

  return (
    <div>
      {(
        ["not_printed", "partially_printed", "printed"] as (typeof lineItemCompletionStatus.enumValues)[number][]
      ).includes(item.completionStatus) && (
        <div className={cn("gap-2", useGrid ? "grid grid-cols-2" : "flex")}>
          {prints.map((print, i) => (
            <Button
              onClick={() => selectPrint(print.id)}
              key={print.id}
              variant="fill"
              className={cn(
                "flex box-border! rounded-2xl! flex-col items-center gap-1 p-4 h-auto flex-1 border-4 relative overflow-clip hover:bg-zinc-100!",
                selectedPrintId === print.id && "border-zinc-400! border-4!",
                getPrintStatus(print.id) === "printed" &&
                  "border-emerald-400! hover:cursor-not-allowed! hover:bg-white!"
              )}
            >
              <div className="font-medium capitalize text-sm">Location: {print.location.replace(/_/g, " ")}</div>
              {print.heatTransferCode ? (
                <div>
                  Heat Transfer:{" "}
                  <Badge variant="secondary" className="text-xs">
                    {print.heatTransferCode}
                    {print.isSmallPrint && " (Small)"}
                  </Badge>
                </div>
              ) : (
                <div>
                  Print Type:{" "}
                  <Badge variant="outline" className="text-xs text-blue-600">
                    DTG
                  </Badge>
                </div>
              )}
              {/* Status bar at bottom */}
              <div
                className={cn(
                  "absolute bottom-0 left-0 right-0 flex h-8 flex-col items-center justify-center bg-gray-200",
                  getPrintStatus(print.id) === "printed" && "bg-emerald-100 text-emerald-800"
                )}
              >
                <div>
                  {print.id !== selectedPrintId
                    ? getPrintStatus(print.id).toLowerCase().replaceAll("_", " ")
                    : "selected"}
                </div>
              </div>
              <div className="h-5" /> {/* Spacer for status bar */}
            </Button>
          ))}

          {/* Empty slots */}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex-1 h-auto p-4 border-zinc-200 border-2 bg-zinc-100 border-dashed rounded-lg flex items-center justify-center text-muted-foreground"
            >
              {/* <Icon icon="ph:placeholder" className="size-5 opacity-30" /> */}
              <div className="text-sm">No {getOrdinalPrintName(printCount + i + 1)} print declared</div>
            </div>
          ))}
        </div>
      )}
      {item.completionStatus === "in_stock" && (
        <Alert className="text-indigo-700 bg-indigo-50">
          <Icon icon="ph:check-circle" className="size-4" />
          <AlertTitle>Item Marked as In Stock</AlertTitle>
          <AlertDescription>
            <p>Inventory has been decremented. You can reset status if this is not the case.</p>
          </AlertDescription>
        </Alert>
      )}
      {item.completionStatus === "oos_blank" && (
        <Alert className="text-red-700 bg-red-50">
          <Icon icon="ph:check-circle" className="size-4" />
          <AlertTitle>Item Marked as OOS Blank</AlertTitle>
          <AlertDescription>
            <p>
              This item has been marked as OOS Blank, the rest of this order line items have been marked as skipped. You
              can reset the status.
            </p>
          </AlertDescription>
        </Alert>
      )}
      <div className="mt-6">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-full block">
                <Button
                  className="w-full"
                  disabled={!isConnected || !selectedPrintId || fileExists === false}
                  aria-disabled={!isConnected || !selectedPrintId || fileExists === false}
                >
                  <Icon icon="ph:file-magnifying-glass" className="size-4" />
                  Open ARXP & Mark as Printed
                </Button>
              </span>
            </TooltipTrigger>
            {!isConnected && <TooltipContent side="top">You are not connected to the file opener</TooltipContent>}
            {isConnected && fileExists === false && <TooltipContent side="top">ARXP file not found</TooltipContent>}
            {isConnected && !selectedPrintId && <TooltipContent side="top">No print selected</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
        <div className="mt-4 flex items-center gap-2 flex-wrap w-full">
          <Button variant="outline" disabled={item.completionStatus === "not_printed"}>
            <Icon icon="ph:arrow-counter-clockwise" className="size-4" />
            Reset
          </Button>
          <Button
            variant="fill"
            className="border-red-200! text-red-600!"
            disabled={item.completionStatus === "in_stock" || item.completionStatus === "oos_blank"}
          >
            <Icon icon="ph:x-circle" className="size-4" />
            Mark OOS
          </Button>
          <Button
            variant="fill"
            className="border-indigo-200! text-indigo-600!"
            disabled={item.completionStatus === "in_stock" || item.completionStatus === "oos_blank"}
          >
            <Icon icon="ph:box-arrow-down" className="size-4" />
            Mark As In stock
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="fill" className="border-emerald-200! text-emerald-600!" disabled={!selectedPrintId}>
                  <Icon icon="ph:check-circle" className="size-4" />
                  Mark As Printed
                </Button>
              </TooltipTrigger>
              {!selectedPrintId && <TooltipContent side="top">No print seslected</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="mt-4">
          {!isConnected ? (
            <Alert>
              <Icon icon="ph:warning-circle" />
              <AlertTitle>You are not connected the file opener.</AlertTitle>
              <AlertDescription>
                <p>Either the file opener is not running, or the config is wrong</p>
                <Link href="/settings" />
              </AlertDescription>
            </Alert>
          ) : arxpDetails ? (
            <div>
              <div className="flex flex-col gap-1">
                <div>
                  <span className="font-semibold text-xs">Looking for file:</span>
                </div>
                <Kbd>{config.arxpFolderPath}</Kbd>
                <div className="flex items-center gap-1">
                  <Kbd>{arxpDetails.path}</Kbd>
                  {fileExists ? (
                    <Badge variant="secondary" className="py-0.5 bg-emerald-50 text-emerald-700">
                      <div className="size-1 bg-emerald-600 rounded-full"></div>
                      File exists
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="py-0.5 text-red-700">
                      <div className="size-1 bg-red-600 rounded-full"></div>
                      Not found
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            (
              ["not_printed", "partially_printed", "printed"] as (typeof lineItemCompletionStatus.enumValues)[number][]
            ).includes(item.completionStatus) && (
              <div className="text-zinc-500 bg-zinc-100 flex justify-center items-center p-4 rounded-lg text-sm">
                select a print
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

// Clean reusable nav button
const NavButton = ({ direction, item }: { direction: "prev" | "next"; item: { id: string } | null }) => {
  const icon = direction === "prev" ? "ph:caret-up" : "ph:caret-down";

  if (item) {
    return (
      <Link className={buttonVariants({ variant: "outline", size: "icon" })} href={`/assembly/${parseGid(item.id)}`}>
        <Icon icon={icon} />
      </Link>
    );
  }

  return (
    <Button variant="outline" size="icon" disabled>
      <Icon icon={icon} />
    </Button>
  );
};

export const OrderDetails = ({
  order,
  dbOrder,
  currentLineItemId,
}: {
  order: Order | undefined;
  dbOrder: AssemblyLineItemWithPrintLogs["order"];
  currentLineItemId: string;
}) => {
  const orderName = order?.name || dbOrder.name;
  const fulfillmentStatus = order?.displayFulfillmentStatus || dbOrder.displayFulfillmentStatus;
  const isCancelled = Boolean(order?.cancelledAt) || dbOrder.displayIsCancelled;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="font-semibold">{orderName}</div>
          <FulfillmentStatusBadge status={fulfillmentStatus} />
          {isCancelled && (
            <Badge variant="outline" className="text-red-600">
              Cancelled
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          {dbOrder.lineItems
            .toSorted((a, b) => a.name.localeCompare(b.name))
            .map((lineItem) => {
              return (
                <Link
                  key={lineItem.id}
                  href={`/assembly/${parseGid(lineItem.id)}`}
                  className="flex items-center gap-2 text-sm mt-2 group"
                >
                  <div
                    className={cn(
                      "size-2 rounded-full bg-zinc-200",
                      currentLineItemId === lineItem.id && "bg-blue-400"
                    )}
                  ></div>
                  <div className="font-medium group-hover:underline underline-offset-2">{lineItem.name}</div>
                  <LineItemStatusBadge status={lineItem.completionStatus} className="text-[10px]" />
                </Link>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};

const getOrdinalPrintName = (printNumber: number) => {
  const ordinalMap = {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
  };
  return ordinalMap[printNumber as keyof typeof ordinalMap];
};
