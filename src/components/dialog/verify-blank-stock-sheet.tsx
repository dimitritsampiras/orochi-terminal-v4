"use client";

import { useMemo, Fragment, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn, parseGid, sleep } from "@/lib/utils";
import type {
  GetBlankStockRequirementsResponse,
  BlankStockItemWithInventory,
} from "@/lib/types/api";
import { UpdateBlankQuantityForm } from "../forms/blank-forms/update-blank-quantity-form";
import { InventoryTransactionItem } from "../cards/inventory-transactions";
import type { batches, garmentSize } from "@drizzle/schema";
import type { SessionOrder } from "../controllers/session-controller";
import { Icon } from "@iconify/react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import dayjs from "dayjs";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import { toast } from "sonner";
import type { CreateOrderHoldSchema } from "@/lib/schemas/order-hold-schema";
import { useRouter } from "next/navigation";

type Batch = typeof batches.$inferSelect;
type GarmentSize = (typeof garmentSize.enumValues)[number];

// Convert db size to display size (e.g., "sm" -> "Small", "2xl" -> "2XL")
const formatSize = (size: GarmentSize): string => {
  const map: Record<GarmentSize, string> = {
    xs: "XSmall",
    sm: "Small",
    md: "Medium",
    lg: "Large",
    xl: "XLarge",
    "2xl": "2XL",
    "3xl": "3XL",
    "4xl": "4XL",
    "5xl": "5XL",
    os: "One Size",
  };
  return map[size] ?? size;
};

// Capitalize first letter of each word
const capitalizeColor = (color: string): string => {
  return color
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Get color sort priority (black first, white second, then alphabetically)
const getColorSortPriority = (color: string): number => {
  const lower = color.toLowerCase();
  if (lower === "black") return 0;
  if (lower === "white") return 1;
  return 2;
};

// Size order for sorting
const sizeOrder: GarmentSize[] = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "os",
];
const getSizeIndex = (size: GarmentSize): number => {
  const idx = sizeOrder.indexOf(size);
  return idx;
}


interface VerifyBlankStockSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: typeof batches.$inferSelect;
  sessionOrders: SessionOrder[];
}

export function VerifyBlankStockSheet({
  open,
  onOpenChange,
  session,
  sessionOrders,
}: VerifyBlankStockSheetProps) {
  const [selectedBlankVariantId, setSelectedBlankVariantId] = useState<
    string | null
  >(null);
  const router = useRouter();

  const sessionId = session.id;
  // Fetch blank stock requirements
  const {
    data: requirementsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["blank-stock-requirements", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/batches/${sessionId}/verify-blank-stock`);
      const data = (await res.json()) as GetBlankStockRequirementsResponse;
      if (!res.ok || data.error) {
        throw new Error(
          data.error ?? "Failed to fetch blank stock requirements",
        );
      }
      return data.data;
    },
    enabled: open,
  });

  const blankItems = requirementsData?.blanks ?? [];

  const selectedBlankVariant = useMemo(() => {
    return blankItems.find(
      (item) => item.blankVariantId === selectedBlankVariantId,
    );
  }, [selectedBlankVariantId, blankItems]);

  const affectedOrders = useMemo(() => {
    return sessionOrders.filter((order) =>
      order.lineItems.some(
        (li) => li.productVariant?.blankVariantId === selectedBlankVariantId,
      ),
    );
  }, [selectedBlankVariantId, sessionOrders]);

  // Mutation to add an order hold
  const addHoldMutation = useMutation({
    mutationFn: async ({
      orderId,
      blankName,
    }: {
      orderId: string;
      blankName: string;
    }) => {
      const parsedOrderId = parseGid(orderId);
      const body: CreateOrderHoldSchema = {
        cause: "stock_shortage",
        reasonNotes: `Blank shortage: ${blankName}`,
      };
      const res = await fetch(`/api/orders/${parsedOrderId}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add hold");
      }
      return res.json();
    },
    onSuccess: async () => {
      await refetch();
      toast.success("Hold added");
      setSelectedBlankVariantId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddHold = async (orderId: string) => {
    if (!selectedBlankVariant) return;
    const blankName = `${selectedBlankVariant.blankName} - ${selectedBlankVariant.color} / ${selectedBlankVariant.size}`;
    addHoldMutation.mutate({ orderId, blankName });
  };

  // Check if there are any shortages
  const hasShortages = useMemo(() => {
    return blankItems.some((item) => item.onHand < item.requiredQuantity);
  }, [blankItems]);

  // Mutation to verify blank stock
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/batches/${sessionId}/verify-blank-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to verify blank stock");
      }
      return res.json();
    },
    onSuccess: async () => {
      await refetch();
      await router.refresh();
      await sleep(1000);
      toast.success("Blank inventory verified");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handlePrintPickingList = () => {
    window.open(
      `/api/batches/${sessionId}/documents/blank-picking-list`,
      "_blank",
    );
  };


  const handleVerify = () => {
    verifyMutation.mutate();
  };

  const renderBlankTable = (items: BlankStockItemWithInventory[]) => {
    if (items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No blanks required
        </p>
      );
    }

    return (
      <Table className="overflow-clip">
        <TableHeader>
          <TableRow>
            <TableHead>Blank</TableHead>
            <TableHead>Color / Size</TableHead>
            <TableHead className="text-right">On Hand</TableHead>
            <TableHead className="text-right">Required</TableHead>
            <TableHead className="text-right">To Pick</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.sort((a, b) => {
            // 1. Color priority
            const colorPriorityA = getColorSortPriority(a.color);
            const colorPriorityB = getColorSortPriority(b.color);
            if (colorPriorityA !== colorPriorityB)
              return colorPriorityA - colorPriorityB;
            // If both are in "rest" category, sort alphabetically
            if (colorPriorityA === 2 && colorPriorityB === 2) {
              const colorCompare = a.color.localeCompare(b.color);
              if (colorCompare !== 0) return colorCompare;
            }

            // 2. Garment type
            const garmentCompare = a.garmentType.localeCompare(b.garmentType);
            if (garmentCompare !== 0) return garmentCompare;

            // 3. Blank name
            const nameCompare = a.blankName.localeCompare(b.blankName);
            if (nameCompare !== 0) return nameCompare;

            // 4. Size (by natural size order)
            return getSizeIndex(a.size) - getSizeIndex(b.size);
          }).map((item, index) => {
            const isShortage = item.onHand < item.requiredQuantity;
            return (
              <Fragment key={item.blankVariantId}>
                <TableRow
                  className={cn(
                    index % 2 === 0 && "bg-zinc-50",
                    item.inventoryTransactions.length > 0 && "border-b-0",
                  )}
                >
                  <TableCell className="font-medium">
                    <div className="text-sm">{item.blankCompany} {item.blankName}</div>
                    <div className="text-xs text-zinc-600">
                      {item.garmentType}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.color} / {item.size}
                  </TableCell>
                  <TableCell className="text-right">
                    <UpdateBlankQuantityForm
                      blankId={item.blankId}
                      blankVariantId={item.blankVariantId}
                      currentQuantity={item.onHand}
                      className="ml-auto"
                      batchId={sessionId}
                      onSuccess={async () => {
                        await refetch();
                        router.refresh();
                        await sleep(1000);
                        toast.success("Blank quantity updated");
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-end justify-end flex-col">
                      <div
                        className={cn(
                          "text-right font-medium",
                          isShortage && "text-red-800",
                        )}
                      >
                        {item.requiredQuantity}
                      </div>
                      {isShortage && (
                        <div className="text-red-600 text-[10px]">Shortage</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold">{item.toPick}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        setSelectedBlankVariantId(item.blankVariantId)
                      }
                    >
                      <Icon icon="ph:eye" className={cn("size-3", isShortage && "text-red-600")} />
                    </Button>
                  </TableCell>
                </TableRow>
                {item.inventoryTransactions.length > 0 && (
                  <TableRow className={cn(index % 2 === 0 && "bg-zinc-50")}>
                    <TableCell colSpan={6}>
                      {item.inventoryTransactions.map((transaction) => (
                        <InventoryTransactionItem
                          key={transaction.id}
                          transaction={transaction}
                        />
                      ))}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full transition-all duration-300",
          selectedBlankVariantId ? "sm:max-w-5xl" : "sm:max-w-2xl",
        )}
      >
        <div className="h-full flex flex-col">
          <SheetHeader className="flex flex-row items-center justify-between">
            <div>
              <SheetTitle>Verify Blank Inventory</SheetTitle>
              <SheetDescription>
                Confirm blank inventory levels for printing
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPickingList}
              className="mr-8"
            >
              Print Blank Picking List
            </Button>
          </SheetHeader>
          <div className="flex flex-row-reverse flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 pb-4 sm:max-w-2xl sm:min-w-2xl">
              {/* Verification Status */}
              {session.blankStockVerifiedAt && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertTitle className="text-green-800">
                    Already Verified
                  </AlertTitle>
                  <AlertDescription className="text-green-700">
                    Blank inventory was verified on{" "}
                    {session.blankStockVerifiedAt
                      ? new Date(session.blankStockVerifiedAt).toLocaleString()
                      : "unknown date"}
                    .
                  </AlertDescription>
                </Alert>
              )}

              {isLoading && (
                <p className="text-center py-8 text-muted-foreground">
                  Loading...
                </p>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}

              {!isLoading && !error && (
                <>
                  {/* Blanks Section */}
                  <div>
                    <Collapsible className="bg-zinc-50 rounded-lg mb-8">
                      <CollapsibleTrigger className="w-full text-sm px-4 p-2 flex items-center justify-between gap-2">
                        <div>
                          There are{" "}
                          <span className="font-semibold">
                            {requirementsData?.filteredItems.length ?? 0}
                          </span>{" "}
                          items that are filtered out from this session.
                        </div>
                        <div
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                          })}
                        >
                          <Icon icon="ph:caret-up-down-bold" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-4 p-2 w-full text-sm">
                        <div className="grid grid-cols-3 gap-2 font-semibold border-b py-1">
                          <span>Item</span>
                          <span>Reason</span>
                          <span className="text-right">Order</span>
                        </div>
                        {requirementsData?.filteredItems.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-3 gap-2 py-1 border-b last:border-b-0 items-center"
                          >
                            <span>{item.name}</span>
                            <span>{item.reason}</span>
                            <span className="text-right">
                              {item.order.name}
                            </span>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">Blanks Required</h3>
                      <Badge variant="secondary">
                        {requirementsData?.blanks.reduce(
                          (acc: number, curr: BlankStockItemWithInventory) =>
                            acc + curr.requiredQuantity,
                          0,
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Blanks needed for printing. Edit quantity and press Enter
                      to save.
                    </p>
                    <div className="border rounded-md overflow-clip bg-white">
                      {renderBlankTable(blankItems)}
                    </div>
                  </div>

                  <hr className="mt-12" />
                  <div className="h-8" />

                  {/* Unaccounted Items Section */}
                  {requirementsData?.malformedItems &&
                    requirementsData.malformedItems.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-zinc-700">
                            Malformed Items — (ignore or fix)
                          </h3>
                          <Badge
                            variant="outline"
                            className="bg-zinc-50 text-zinc-700"
                          >
                            {requirementsData.malformedItems.length}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          These items have missing blank data. Contact admin to
                          fix.
                        </p>
                        <div className="border rounded-md bg-white p-3 space-y-1">
                          {requirementsData.malformedItems.map((item) => (
                            <div
                              key={item.lineItemName}
                              className="flex justify-between text-sm"
                            >
                              <span>{item.lineItemName}</span>
                              <span className="text-zinc-600">
                                {item.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              )}
            </div>

            {/* Preview Panel */}
            {selectedBlankVariantId && (
              <div className="w-96 border-r bg-zinc-50 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-sm">Affected Orders</h4>
                    <p className="text-xs text-muted-foreground">
                      {selectedBlankVariant?.blankName}{" "}
                      {selectedBlankVariant?.blankCompany} (
                      {selectedBlankVariant?.color} /{" "}
                      {selectedBlankVariant?.size})
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setSelectedBlankVariantId(null)}
                  >
                    <Icon icon="ph:x" className="size-3" />
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  {affectedOrders.map((order) => {
                    return (
                      <Card key={order.id}>
                        <CardHeader>
                          <CardTitle>{order.name}</CardTitle>
                          <CardDescription>
                            {dayjs(order.createdAt).format("MMM DD, YYYY")}
                          </CardDescription>
                          <CardAction>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleAddHold(order.id)}
                              loading={addHoldMutation.isPending}
                            >
                              Add Hold
                            </Button>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="bg-zinc-100 rounded-md mx-4 p-3">
                          {order.lineItems.map((lineItem) => {
                            const blankVariant = blankItems.find(item => item.blankVariantId === lineItem.productVariant?.blankVariantId);
                            const isItemAffected =
                              lineItem.productVariant?.blankVariantId ===
                              selectedBlankVariantId;
                            const onHand = blankVariant?.onHand ?? 0;
                            const requiredQuantity = blankVariant?.requiredQuantity ?? 0;
                            const isItemShortage = onHand < requiredQuantity;
                            return (
                              <div
                                key={lineItem.id}
                                className="flex justify-between items-center"
                              >
                                <div
                                  className={cn(
                                    "text-xs",
                                    isItemShortage && isItemAffected && "text-red-700",
                                  )}
                                >
                                  {lineItem.name}
                                </div>
                                {lineItem.productId && (
                                  <Link
                                    href={`/products/${parseGid(lineItem.productId)}`}
                                    target="_blank"
                                    className={buttonVariants({
                                      size: "sm",
                                      variant: "link",
                                      className: "text-xs",
                                    })}
                                  >
                                    View
                                  </Link>
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="border-t pt-4">
            <Button
              onClick={handleVerify}
              disabled={
                hasShortages ||
                Boolean(session.blankStockVerifiedAt) ||
                blankItems.length === 0
              }
              loading={verifyMutation.isPending}
            >
              Verify Blank Inventory
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
