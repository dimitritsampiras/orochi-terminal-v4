"use client";

import {
  AssemblyLineItemWithPrintLogs,
  type AssemblyLineItem,
} from "@/lib/core/session/create-assembly-line";
import { BackButton } from "../nav/back-button";
import { NavButton } from "../nav/nav-button";
import { useAssemblyNavigation } from "@/lib/stores";
import { useEffect, useMemo, useState } from "react";
import {
  GetAssemblyLineResponse,
  MarkPrintedResponse,
  MarkStockedResponse,
  MarkOosResponse,
  ResetLineItemResponse,
} from "@/lib/types/api";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "../ui/button";
import { Icon } from "@iconify/react";
import {
  cn,
  getProductDetailsForARXP,
  normalizeSizeName,
  parseGid,
  sleep,
  standardizePrintOrder,
} from "@/lib/utils";
import { AssemblyLineMediaGrid } from "../cards/product-media";
import { Badge } from "../ui/badge";
import { OrderQuery } from "@/lib/types/admin.generated";
import { MediaImage } from "@/lib/types/misc";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { useLocalServer } from "@/lib/hooks/use-local-server";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Kbd } from "../ui/kbd";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  InventoryTransactionsCard,
  InventoryTransactionsList,
} from "../cards/inventory-transactions";
import { FulfillmentStatusBadge } from "../badges/fulfillment-status-badge";
import { LineItemStatusBadge } from "../badges/line-item-status-badge";
import {
  inventoryTransactions as inventoryTransactionsTable,
  lineItemCompletionStatus,
} from "@drizzle/schema";
import { IdCopyBadge } from "../badges/id-copy-badge";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  MarkPrintedSchema,
  MarkStockedSchema,
  MarkOosSchema,
  ResetLineItemSchema,
} from "@/lib/schemas/assembly-schema";

type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;
type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;

export const AssemblyItemController = ({
  item,
  media,
  order,
  batchId: initialBatchId,
  inventoryTransactions,
}: {
  item: AssemblyLineItemWithPrintLogs;
  media: MediaImage[];
  order: Order | undefined;
  batchId?: number;
  inventoryTransactions: InventoryTransaction[];
}) => {
  const {
    getNavigation,
    setNavigation,
    items,
    batchId: storedBatchId,
  } = useAssemblyNavigation();
  const { prev, next, position } = getNavigation(item.id);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // Use provided batchId or fall back to store (convert null to undefined)
  const batchId = initialBatchId ?? storedBatchId ?? undefined;

  const shopifyLineItem = order?.lineItems.nodes.find(
    (lineItem) => lineItem.id === item.id
  );

  const noSyncedPrints =
    item.prints.length === 0 && !Boolean(item.product?.isBlackLabel);
  const noSyncedBlank =
    !Boolean(item.product?.isBlackLabel) && !Boolean(item.blankVariant);

  useEffect(() => {
    setHasMounted(true);
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
  }, [hasNavigation, setNavigation]);

  return (
    <div>
      <div className="flex justify-between items-center">
        <div className="flex items-start gap-3">
          <BackButton fallbackHref="/assembly" className="mt-1" />
          <div>
            <h1 className="page-title">
              {hasNavigation && `${position + 1}. `}
              {item.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              {hasNavigation && (
                <p className="text-sm text-muted-foreground mr-2">
                  {position + 1} of {items.length}
                </p>
              )}
              <LineItemStatusBadge status={item.completionStatus} />
              <IdCopyBadge id={item.id} />
            </div>
          </div>
        </div>

        {hasNavigation && (
          <div className="flex items-center gap-2">
            <NavButton
              direction="up"
              href={prev ? `/assembly/${parseGid(prev.id)}` : null}
            />
            <NavButton
              direction="down"
              href={next ? `/assembly/${parseGid(next.id)}` : null}
            />
          </div>
        )}
      </div>

      <div className="my-4 flex flex-col gap-2">
        {item.quantity > 1 ? (
          <Alert className="text-amber-700 bg-amber-50">
            <Icon icon="ph:warning-circle" className="size-4" />
            <AlertTitle>
              Multiple line item quantity: {item.quantity}
            </AlertTitle>
            <AlertDescription>
              <p>
                This item has a quantity of {item.quantity}. The duplicate items
                need to be printed manually. Please ensure necessary stock
                levels are adjusted.
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
        ) : null}
        {(order?.displayFulfillmentStatus === "FULFILLED" ||
          item.order.displayFulfillmentStatus === "FULFILLED") && (
          <Alert className="text-amber-700 bg-amber-50">
            <Icon icon="ph:warning-circle" className="size-4" />
            <AlertTitle>Order already fulfilled</AlertTitle>
            <AlertDescription>
              <p>
                This order has already been fulfilled. There should be no need
                to print this item unless specified otherwise
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
                This item has no synced prints. Either declare how many prints
                it needs in the product page or set it as a black label item.
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
                This order is marked as cancelled. There should be no need to
                print this item unless specified otherwise
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
                This order is marked as cancelled. There should be no need to
                print this item unless specified otherwise
              </p>
            </AlertDescription>
          </Alert>
        )}

        {(item.expectedFulfillment === "stock" ||
          item.expectedFulfillment === "black_label") && (
          <Alert
            className={cn(
              "text-blue-800 bg-blue-50",
              item.expectedFulfillment === "black_label" &&
                "text-indigo-800 bg-indigo-50"
            )}
          >
            <Icon icon="ph:warning-circle" className="size-4" />
            <AlertTitle>Product is in stock</AlertTitle>
            <AlertDescription>
              <p>
                This product is expected to be fulfilled by premade stock.
                Please ensure the premade stock is in stock.
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
                  <p>
                    This line item is not fulfillable. The order has likely
                    already been fulfilled or removed fr.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {!shopifyLineItem.requiresShipping && (
              <Alert className="text-red-700 bg-red-50">
                <Icon icon="ph:warning-circle" className="size-4" />
                <AlertTitle>Line item is not shippable</AlertTitle>
                <AlertDescription>
                  <p>
                    This line item is not something that will be shipped. It
                    does not need to be printed.
                  </p>
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
                ? order?.lineItems.nodes.find(
                    (lineItem) => lineItem.id === item.id
                  )?.image?.id || undefined
                : undefined
            }
          />
          <Prints
            item={item}
            batchId={batchId}
            inventoryTransactions={inventoryTransactions}
          />
        </div>
        <div className="flex flex-col gap-4">
          <OrderDetails
            order={order}
            dbOrder={item.order}
            currentLineItemId={item.id}
          />
          {!item.product?.isBlackLabel && <BlankDetails blank={item.blank} blankVariant={item.blankVariant} />}
          <ProductDetails
            product={item.product}
            productVariant={item.productVariant}
          />
          <InventoryTransactionsCard
            inventoryTransactions={inventoryTransactions}
          />
        </div>
      </div>
    </div>
  );
};

const Prints = ({
  item,
  batchId,
  inventoryTransactions,
}: {
  item: AssemblyLineItemWithPrintLogs;
  batchId: number | undefined;
  inventoryTransactions: InventoryTransaction[];
}) => {
  const router = useRouter();
  const { isConnected, config, checkFileExists, openFile } = useLocalServer();
  const printCount = item.prints.length;
  const prints = standardizePrintOrder(item.prints);
  const [fileExists, setFileExists] = useState<boolean | null>(null);

  // 1-2 prints: single row, 3-4 prints: 2x2 grid
  const useGrid = printCount > 2;
  const emptySlots = useGrid
    ? Math.max(0, 4 - printCount)
    : Math.max(0, 2 - printCount);

  const [selectedPrintId, setSelectedPrintId] = useState<string | null>(null);

  // Dialog state for "already printed" scenario
  const [showAlreadyPrintedDialog, setShowAlreadyPrintedDialog] =
    useState(false);
  const [pendingPrintAction, setPendingPrintAction] = useState<
    "print" | "arxp" | null
  >(null);

  // Dialog state for "mark as in stock" scenario
  const [showStockDialog, setShowStockDialog] = useState(false);

  // Dialog state for "mark as OOS" scenario
  const [showOosDialog, setShowOosDialog] = useState(false);

  // Stock validation
  const blankStock = item.blankVariant?.quantity ?? 0;
  const productStock = item.productVariant?.warehouseInventory ?? 0;
  const hasBlankStock = blankStock > 0;
  const hasProductStock = productStock > 0;

  // Check if we should show the "already printed" dialog
  // This happens when: hasDeprecatedBlankStock is true AND status is NOT partially_printed
  const shouldPromptForInventoryChoice =
    item.hasDeprecatedBlankStock &&
    item.completionStatus !== "partially_printed";

  const itemAlreadyMarkedAsStatus = (
    [
      "printed",
      "in_stock",
      "oos_blank",
    ] as (typeof lineItemCompletionStatus.enumValues)[number][]
  ).includes(item.completionStatus);

  const getPrintStatus = (printId: string) => {
    const printLog = item.printLogs
      .filter((log) => log.active)
      .find((log) => log.printId === printId);

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

  // === MUTATIONS ===
  const markPrintedMutation = useMutation({
    mutationFn: async (input: MarkPrintedSchema) => {
      const res = await fetch(`/api/assembly/${parseGid(item.id)}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as MarkPrintedResponse;
      if (!res.ok || data.error)
        throw new Error(data.error ?? "Failed to mark as printed");
      return data;
    },
    onSuccess: async (data) => {
      router.refresh();
      await sleep(1000);
      toast.success(
        `Print marked as completed${data.data?.inventoryChanged ? " (inventory adjusted)" : ""}`
      );
      setSelectedPrintId(null);
      setShowAlreadyPrintedDialog(false);
      setPendingPrintAction(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const markStockedMutation = useMutation({
    mutationFn: async (input: MarkStockedSchema) => {
      const res = await fetch(`/api/assembly/${parseGid(item.id)}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as MarkStockedResponse;
      if (!res.ok || data.error)
        throw new Error(data.error ?? "Failed to mark as in stock");
      return data;
    },
    onSuccess: async (data) => {
      router.refresh();
      await sleep(1000);
      toast.success(
        `Item marked as in stock${data.data?.inventoryChanged ? " (inventory adjusted)" : ""}`
      );
      setShowStockDialog(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const markOosMutation = useMutation({
    mutationFn: async (input: MarkOosSchema) => {
      const res = await fetch(`/api/assembly/${parseGid(item.id)}/oos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as MarkOosResponse;
      if (!res.ok || data.error)
        throw new Error(data.error ?? "Failed to mark as out of stock");
      return data;
    },
    onSuccess: async (data) => {
      router.refresh();
      await sleep(1000);
      toast.success(
        `Item marked as out of stock. Other items in order marked as skipped.${
          data.data?.inventoryChanged ? " (inventory adjusted)" : ""
        }`
      );
      setShowOosDialog(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const resetMutation = useMutation({
    mutationFn: async (input: ResetLineItemSchema) => {
      const res = await fetch(`/api/assembly/${parseGid(item.id)}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as ResetLineItemResponse;
      if (!res.ok || data.error)
        throw new Error(data.error ?? "Failed to reset item");
      return data;
    },
    onSuccess: async (data) => {
      router.refresh();
      await sleep(1000);
      toast.success(
        `Item reset to not printed${data.data?.inventoryChanged ? " (inventory restored)" : ""}`
      );
      setSelectedPrintId(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const isAnyMutationPending =
    markPrintedMutation.isPending ||
    markStockedMutation.isPending ||
    markOosMutation.isPending ||
    resetMutation.isPending;

  // === HANDLERS ===

  // Intercept print action to check if we need to show dialog
  const handleMarkAsPrintedWithCheck = () => {
    if (!selectedPrintId || !batchId) return;

    if (shouldPromptForInventoryChoice) {
      setPendingPrintAction("print");
      setShowAlreadyPrintedDialog(true);
    } else {
      markPrintedMutation.mutate({ printId: selectedPrintId, batchId });
    }
  };

  // Called from dialog: user chose to decrement blank
  const handlePrintAndDecrementBlank = () => {
    if (!selectedPrintId || !batchId) return;
    markPrintedMutation.mutate({
      printId: selectedPrintId,
      batchId,
      skipInventoryAdjustment: false,
    });
  };

  // Called from dialog: user chose NOT to decrement blank
  const handlePrintWithoutDecrement = () => {
    if (!selectedPrintId || !batchId) return;
    markPrintedMutation.mutate({
      printId: selectedPrintId,
      batchId,
      skipInventoryAdjustment: true,
    });
  };

  const handleMarkAsStocked = () => {
    if (!batchId) return;
    setShowStockDialog(true);
  };

  const handleConfirmStocked = (reduceInventory: boolean) => {
    if (!batchId) return;
    markStockedMutation.mutate({ batchId, reduceInventory });
  };

  const handleMarkAsOos = () => {
    if (!batchId) return;
    setShowOosDialog(true);
  };

  const handleConfirmOos = () => {
    if (!batchId) return;
    markOosMutation.mutate({ batchId });
  };

  const handleReset = () => {
    if (!batchId) return;
    resetMutation.mutate({ batchId });
  };

  const handleOpenArxpAndPrint = async () => {
    if (
      !arxpDetails ||
      !config.arxpFolderPath ||
      !isConnected ||
      !selectedPrintId ||
      !batchId
    )
      return;

    try {
      const basePath = config.arxpFolderPath.replace(/\/$/, "");
      const fullPath = `${basePath}/${arxpDetails.path}`;
      await openFile(fullPath);

      // After opening the file, check if we need dialog
      if (shouldPromptForInventoryChoice) {
        setPendingPrintAction("arxp");
        setShowAlreadyPrintedDialog(true);
      } else {
        markPrintedMutation.mutate({ printId: selectedPrintId, batchId });
      }
    } catch (e) {
      console.error("Failed to open file", e);
      toast.error("Failed to open file");
    }
  };

  const arxpDetails = useMemo(() => {
    const printIndex = selectedPrintId
      ? prints.findIndex((print) => print.id === selectedPrintId)
      : -1;
    if (printIndex === -1) {
      return null;
    }

    const details =
      item.product && item.productVariant
        ? getProductDetailsForARXP(
            item.product,
            item.productVariant,
            printIndex
          )
        : null;

    return details;
  }, [selectedPrintId, item.product, item.productVariant, prints]);

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
        [
          "not_printed",
          "partially_printed",
          "printed",
        ] as (typeof lineItemCompletionStatus.enumValues)[number][]
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
              <div className="font-medium capitalize text-sm">
                Location: {print.location.replace(/_/g, " ")}
              </div>
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
                  getPrintStatus(print.id) === "printed" &&
                    "bg-emerald-100 text-emerald-800"
                )}
              >
                <div>
                  {print.id !== selectedPrintId
                    ? getPrintStatus(print.id)
                        .toLowerCase()
                        .replaceAll("_", " ")
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
              <div className="text-sm">
                No {getOrdinalPrintName(printCount + i + 1)} print declared
              </div>
            </div>
          ))}
        </div>
      )}
      {item.product?.isBlackLabel && (
        <Alert className="text-purple-700 bg-purple-50">
          <Icon icon="ph:check-circle" className="size-4" />
          <AlertTitle>Black Label Item</AlertTitle>
          <AlertDescription>
            <p>
              This item is a black label item. It is not synced to a blank. You
              cannot print this item.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {item.completionStatus === "in_stock" && (
        <Alert className="text-indigo-700 bg-indigo-50">
          <Icon icon="ph:check-circle" className="size-4" />
          <AlertTitle>Item Marked as In Stock</AlertTitle>
          <AlertDescription>
            <p>
              Inventory has been decremented. You can reset status if this is
              not the case.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {item.completionStatus === "oos_blank" && (
        <Alert className="text-red-700 bg-red-50">
          <Icon icon="ph:check-circle" className="size-4" />
          <AlertTitle>Item Marked as OOS Blank</AlertTitle>
          <AlertDescription>
            <p>
              This item has been marked as OOS Blank, the rest of this order
              line items have been marked as skipped. You can reset the status.
            </p>
          </AlertDescription>
        </Alert>
      )}
      {item.completionStatus === "skipped" && (
        <Alert className="text-amber-700 bg-amber-50">
          <Icon icon="ph:skip-forward" className="size-4" />
          <AlertTitle>Item Skipped</AlertTitle>
          <AlertDescription>
            <p>
              Another item in this order was marked as out of stock. This item
              was automatically skipped.
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
                  disabled={
                    !isConnected ||
                    !selectedPrintId ||
                    fileExists === false ||
                    isAnyMutationPending ||
                    !batchId ||
                    (!hasBlankStock && !item.hasDeprecatedBlankStock)
                  }
                  aria-disabled={
                    !isConnected ||
                    !selectedPrintId ||
                    fileExists === false ||
                    isAnyMutationPending ||
                    (!hasBlankStock && !item.hasDeprecatedBlankStock)
                  }
                  onClick={handleOpenArxpAndPrint}
                >
                  {markPrintedMutation.isPending ? (
                    <Icon icon="ph:spinner" className="size-4 animate-spin" />
                  ) : (
                    <Icon icon="ph:file-magnifying-glass" className="size-4" />
                  )}
                  Open ARXP & Mark as Printed
                </Button>
              </span>
            </TooltipTrigger>
            {!batchId && (
              <TooltipContent side="top">
                No active session found
              </TooltipContent>
            )}
            {batchId && !hasBlankStock && !item.hasDeprecatedBlankStock && (
              <TooltipContent side="top">
                Blank stock is empty - adjust inventory first
              </TooltipContent>
            )}
            {batchId && !isConnected && (
              <TooltipContent side="top">
                You are not connected to the file opener
              </TooltipContent>
            )}
            {batchId && isConnected && fileExists === false && (
              <TooltipContent side="top">ARXP file not found</TooltipContent>
            )}
            {batchId && isConnected && !selectedPrintId && (
              <TooltipContent side="top">No print selected</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <div className="mt-4 flex items-center gap-2 flex-wrap w-full">
          <Button
            variant="outline"
            disabled={
              item.completionStatus === "not_printed" ||
              isAnyMutationPending ||
              item.completionStatus === "skipped" ||
              !batchId
            }
            onClick={handleReset}
          >
            {resetMutation.isPending ? (
              <Icon icon="ph:spinner" className="size-4 animate-spin" />
            ) : (
              <Icon icon="ph:arrow-counter-clockwise" className="size-4" />
            )}
            Reset
          </Button>
          <Button
            variant="fill"
            className="border-red-200! text-red-600!"
            disabled={
              item.completionStatus === "in_stock" ||
              item.completionStatus === "oos_blank" ||
              isAnyMutationPending ||
              item.completionStatus === "skipped" ||
              !batchId
            }
            onClick={handleMarkAsOos}
          >
            {markOosMutation.isPending ? (
              <Icon icon="ph:spinner" className="size-4 animate-spin" />
            ) : (
              <Icon icon="ph:x-circle" className="size-4" />
            )}
            Mark OOS
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="fill"
                  className="border-indigo-200! text-indigo-600!"
                  disabled={
                    item.completionStatus === "in_stock" ||
                    item.completionStatus === "oos_blank" ||
                    item.completionStatus === "skipped" ||
                    isAnyMutationPending ||
                    !batchId
                  }
                  onClick={handleMarkAsStocked}
                >
                  {markStockedMutation.isPending ? (
                    <Icon icon="ph:spinner" className="size-4 animate-spin" />
                  ) : (
                    <Icon icon="ph:box-arrow-down" className="size-4" />
                  )}
                  Mark As In stock
                </Button>
              </TooltipTrigger>
              {!batchId && (
                <TooltipContent side="top">
                  No active session found
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="fill"
                  className="border-emerald-200! text-emerald-600!"
                  disabled={
                    !selectedPrintId ||
                    isAnyMutationPending ||
                    !batchId ||
                    (!hasBlankStock && !item.hasDeprecatedBlankStock)
                  }
                  onClick={handleMarkAsPrintedWithCheck}
                >
                  {markPrintedMutation.isPending ? (
                    <Icon icon="ph:spinner" className="size-4 animate-spin" />
                  ) : (
                    <Icon icon="ph:check-circle" className="size-4" />
                  )}
                  Mark As Printed
                </Button>
              </TooltipTrigger>
              {!batchId && (
                <TooltipContent side="top">
                  No active session found
                </TooltipContent>
              )}
              {batchId && !selectedPrintId && (
                <TooltipContent side="top">No print selected</TooltipContent>
              )}
              {batchId && !hasBlankStock && !item.hasDeprecatedBlankStock && (
                <TooltipContent side="top">
                  Blank stock is empty - adjust inventory first
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="mt-4">
          {!isConnected ? (
            <Alert>
              <Icon icon="ph:warning-circle" />
              <AlertTitle>You are not connected the file opener.</AlertTitle>
              <AlertDescription>
                <p>
                  Either the file opener is not running, or the config is wrong
                </p>
                <Link href="/settings" />
              </AlertDescription>
            </Alert>
          ) : arxpDetails ? (
            <div>
              <div className="flex flex-col gap-1">
                <div>
                  <span className="font-semibold text-xs">
                    Looking for file:
                  </span>
                </div>
                <Kbd>{config.arxpFolderPath}</Kbd>
                <div className="flex items-center gap-1">
                  <Kbd>{arxpDetails.path}</Kbd>
                  {fileExists ? (
                    <Badge
                      variant="secondary"
                      className="py-0.5 bg-emerald-50 text-emerald-700"
                    >
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
              [
                "not_printed",
                "partially_printed",
                "printed",
              ] as (typeof lineItemCompletionStatus.enumValues)[number][]
            ).includes(item.completionStatus) && (
              <div className="text-zinc-500 bg-zinc-100 flex justify-center items-center p-4 rounded-lg text-sm">
                select a print
              </div>
            )
          )}
        </div>

        {/* Stock warnings */}
        {!hasBlankStock &&
          item.blankVariant &&
          item.completionStatus === "not_printed" && (
            <Alert className="text-red-700 bg-red-50 mt-4">
              <Icon icon="ph:warning-circle" className="size-4" />
              <AlertTitle>Blank stock is empty</AlertTitle>
              <AlertDescription>
                <p>
                  Cannot print - blank inventory is 0. Please adjust inventory
                  levels before proceeding or mark as OOS.
                </p>
              </AlertDescription>
            </Alert>
          )}
      </div>

      {/* Already Printed Dialog - shown when hasDeprecatedBlankStock is true and user tries to print again */}
      <AlertDialog
        open={showAlreadyPrintedDialog}
        onOpenChange={setShowAlreadyPrintedDialog}
      >
        <AlertDialogContent className="sm:min-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Blank Already Used</AlertDialogTitle>
            <AlertDialogDescription>
              This item was previously printed and blank inventory was already
              reduced. If you're reprinting due to a misprint or error, choose
              whether to reduce blank inventory again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 p-3 bg-zinc-50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Current blank stock:</span>
              <span className="font-medium">{blankStock}</span>
            </div>
          </div>
          <InventoryTransactionsList transactions={inventoryTransactions} />
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAlreadyPrintedDialog(false);
                setPendingPrintAction(null);
              }}
              disabled={markPrintedMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintWithoutDecrement}
              disabled={markPrintedMutation.isPending}
            >
              {markPrintedMutation.isPending && pendingPrintAction ? (
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
              ) : null}
              Only Mark as Printed
            </Button>
            <Button
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              variant="outline"
              onClick={handlePrintAndDecrementBlank}
              disabled={markPrintedMutation.isPending || !hasBlankStock}
            >
              {markPrintedMutation.isPending && pendingPrintAction ? (
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
              ) : null}
              Mark as Printed & Decrement Blank
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as In Stock Dialog */}
      <AlertDialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as In Stock</AlertDialogTitle>
            <AlertDialogDescription>
              This item will be fulfilled from pre-made stock. Would you like to
              reduce the product inventory?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 p-3 bg-zinc-50 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Current product stock:</span>
              <span className="font-medium">{productStock}</span>
            </div>
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowStockDialog(false)}
              disabled={markStockedMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleConfirmStocked(false)}
              disabled={markStockedMutation.isPending}
              loading={markStockedMutation.isPending}
            >
              Mark In Stock Only
            </Button>
            <Button
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              variant="outline"
              onClick={() => handleConfirmStocked(true)}
              disabled={markStockedMutation.isPending || !hasProductStock}
              loading={markStockedMutation.isPending}
            >
              Mark & Reduce Inventory
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as OOS Confirmation Dialog */}
      <AlertDialog open={showOosDialog} onOpenChange={setShowOosDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Out of Stock</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark this item as out of stock. All other items in this
              order will be automatically skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowOosDialog(false)}
              disabled={markOosMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="border-red-200 text-red-700 hover:bg-red-50"
              variant="outline"
              onClick={handleConfirmOos}
              disabled={markOosMutation.isPending}
              loading={markOosMutation.isPending}
            >
              Mark as OOS
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
  const fulfillmentStatus =
    order?.displayFulfillmentStatus || dbOrder.displayFulfillmentStatus;
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
                  <div className="font-medium group-hover:underline underline-offset-2">
                    {lineItem.name}
                  </div>
                  <LineItemStatusBadge
                    status={lineItem.completionStatus}
                    className="text-[10px]"
                  />
                </Link>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};
const BlankDetails = ({
  blank,
  blankVariant,
}: {
  blank: AssemblyLineItemWithPrintLogs["blank"];
  blankVariant: AssemblyLineItemWithPrintLogs["blankVariant"];
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Blank Details</CardTitle>
      </CardHeader>
      <CardContent>
        {blank && blankVariant && (
          <div>
            <div className="flex justify-between">
              <div>
                <div className="text-zinc-500 text-xs">Current stock</div>
                <div className="font-semibold text-4xl">
                  {blankVariant.quantity}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm capitalize">
                  {blank.blankCompany} {blank.blankName}
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Badge
                    variant="outline"
                    className="text-zinc-600 text-[10px]"
                  >
                    {blank.garmentType}
                  </Badge>
                  <div className="text-sm">
                    {normalizeSizeName(blankVariant.size)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ProductDetails = ({
  product,
  productVariant,
}: {
  product: AssemblyLineItemWithPrintLogs["product"];
  productVariant: AssemblyLineItemWithPrintLogs["productVariant"];
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Details</CardTitle>
      </CardHeader>
      <CardContent>
        {product && productVariant && (
          <div>
            <div className="flex justify-between">
              <div>
                <div className="text-zinc-500 text-xs">Current stock</div>
                <div className="font-semibold text-4xl">
                  {productVariant.warehouseInventory}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm capitalize">{product.title}</div>
                <div className="flex items-center gap-2 justify-end">
                  <Badge
                    variant="outline"
                    className="text-zinc-600 text-[10px]"
                  >
                    {productVariant.title}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
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
