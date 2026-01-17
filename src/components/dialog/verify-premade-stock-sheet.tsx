"use client";

import { useMemo, Fragment } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, sleep } from "@/lib/utils";
import type {
  GetPremadeStockRequirementsResponse,
  PremadeStockItemWithInventory,
  VerifyPremadeStockResponse,
} from "@/lib/types/api";
import { UpdateOverstockForm } from "../forms/product-forms/update-overstock-form";
import { InventoryTransactionItem } from "../cards/inventory-transactions";
import { batches } from "@drizzle/schema";
import { useRouter } from "next/navigation";

interface VerifyPremadeStockSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: typeof batches.$inferSelect;
  ordersWithHolds: { orderName: string; holdCount: number }[];
}

export function VerifyPremadeStockSheet({
  open,
  onOpenChange,
  session,
  ordersWithHolds,
}: VerifyPremadeStockSheetProps) {
  const sessionId = session.id;
  const queryClient = useQueryClient();
  const router = useRouter();

  // Fetch premade stock requirements
  const {
    data: requirementsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["premade-stock-requirements", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/batches/${sessionId}/verify-premade-stock`);
      const data = (await res.json()) as GetPremadeStockRequirementsResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to fetch premade stock requirements");
      }
      return data.data;
    },
    enabled: open,
  });

  // Mark as verified mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/batches/${sessionId}/verify-premade-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as VerifyPremadeStockResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to mark as verified");
      }
      return data.data;
    },
    onSuccess: async () => {
      router.refresh();
      queryClient.invalidateQueries({ queryKey: ["premade-stock-requirements", sessionId] });
      await sleep(1000);
      toast.success("Premade stock verified");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Split items into overstock and black label
  const { overstockItems, blackLabelItems } = useMemo(() => {
    const items = requirementsData?.items.premade ?? [];
    return {
      overstockItems: items.filter((item) => !item.isBlackLabel),
      blackLabelItems: items.filter((item) => item.isBlackLabel),
    };
  }, [requirementsData?.items?.premade]);

  const handlePrintPickingList = () => {
    window.open(`/api/batches/${sessionId}/documents/premade-picking-list`, "_blank");
  };

  const handleRefetch = () => {
    refetch();
  };

  const renderStockTable = (items: PremadeStockItemWithInventory[], isBlackLabel: boolean) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground py-4 text-center">No items</p>;
    }

    return (
      <Table className="overflow-clip">
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Variant</TableHead>
            {!isBlackLabel && <TableHead className="text-right">On Hand</TableHead>}
            <TableHead className="text-right">Required</TableHead>
            <TableHead className="text-right">To Pick</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(({ onHand, requiredQuantity, toPick, ...item }, index) => {
            const isNegative = onHand - requiredQuantity < 0;
            return (
              <Fragment key={item.productVariantId}>
                <TableRow
                  className={cn(index % 2 === 0 && "bg-zinc-50", item.inventoryTransactions.length > 0 && "border-b-0")}
                >
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{item.productVariantTitle}</TableCell>
                  {!isBlackLabel && (
                    <TableCell className="text-right">
                      <UpdateOverstockForm
                        productId={item.productId}
                        variantId={item.productVariantId}
                        isBlackLabel={item.isBlackLabel}
                        currentWarehouseInventory={onHand}
                        batchId={sessionId}
                        onSuccess={handleRefetch}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {isNegative && !isBlackLabel && (
                        <Badge variant="outline" className="text-[10px] bg-orange-50">
                          Shortage
                        </Badge>
                      )}
                      <div className="min-w-[12px]">{requiredQuantity}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-right font-semibold">{toPick}</span>
                  </TableCell>
                </TableRow>
                {item.inventoryTransactions.length > 0 && (
                  <TableRow className={cn(index % 2 === 0 && "bg-zinc-50")}>
                    <TableCell colSpan={5}>
                      {item.inventoryTransactions.map((transaction) => (
                        <InventoryTransactionItem key={transaction.id} transaction={transaction} />
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
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between">
          <div>
            <SheetTitle>Verify Premade Stock</SheetTitle>
            <SheetDescription>Confirm premade stock inventory levels</SheetDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrintPickingList} className="mr-8">
            Print Premade Picking List
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
          {/* Orders on Hold Alert */}
          {ordersWithHolds.length > 0 && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertTitle className="text-blue-800">Orders on Hold</AlertTitle>
              <AlertDescription className="text-blue-700">
                {ordersWithHolds.length} order{ordersWithHolds.length !== 1 ? "s" : ""} in this session have active
                holds and are excluded from stock requirements.
                <ul className="mt-2 text-sm list-disc list-inside">
                  {ordersWithHolds.slice(0, 5).map((o) => (
                    <li key={o.orderName}>{o.orderName}</li>
                  ))}
                  {ordersWithHolds.length > 5 && (
                    <li className="text-muted-foreground">...and {ordersWithHolds.length - 5} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Verification Status */}
          {requirementsData?.isVerified && (
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle className="text-green-800">Already Verified</AlertTitle>
              <AlertDescription className="text-green-700">
                This session's premade stock was verified on{" "}
                {requirementsData.verifiedAt ? new Date(requirementsData.verifiedAt).toLocaleString() : "unknown date"}.
                You can still make adjustments.
              </AlertDescription>
            </Alert>
          )}

          {isLoading && <p className="text-center py-8 text-muted-foreground">Loading...</p>}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && (
            <>
              {/* Overstock Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">Overstock Items</h3>
                  <Badge variant="secondary">
                    {overstockItems.reduce((acc, curr) => acc + curr.requiredQuantity, 0)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Pre-printed items. Edit inventory and press Enter to save.
                </p>
                <div className="border rounded-md overflow-clip bg-white">
                  {renderStockTable(overstockItems, false)}
                </div>
              </div>

              {/* Black Label Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">Black Label Items</h3>
                  <Badge variant="outline" className="bg-zinc-100">
                    {blackLabelItems.reduce((acc, curr) => acc + curr.requiredQuantity, 0)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Inventory is managed by Shopify.</p>
                <div className="border rounded-md overflow-clip bg-white">
                  {renderStockTable(blackLabelItems, true)}
                </div>
              </div>

              <hr className="mt-24" />
              <div className="h-14" />

              {/* Held Items Section */}
              {requirementsData?.items.held && requirementsData.items.held.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-blue-700">Orders on Hold — (ignore)</h3>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {requirementsData.items.held.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    These items are from orders on hold and are excluded from this session.
                  </p>
                  <div className="border rounded-md bg-white p-3 space-y-1">
                    {requirementsData.items.held.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.lineItemName}</span>
                        <span className="text-muted-foreground">{item.orderNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unaccounted Items Section */}
              {requirementsData?.items.unaccounted && requirementsData.items.unaccounted.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-zinc-700">Unaccounted Items — (ignore)</h3>
                    <Badge variant="outline" className="bg-zinc-50 text-zinc-700">
                      {requirementsData.items.unaccounted.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    These items have missing product or blank data. Contact admin to fix.
                  </p>
                  <div className="border rounded-md bg-white p-3 space-y-1">
                    {requirementsData.items.unaccounted.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.lineItemName}</span>
                        <span className="text-zinc-600">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter className="border-t pt-4">
          <Button
            onClick={() => verifyMutation.mutate()}
            loading={verifyMutation.isPending}
            disabled={!!session.premadeStockRequirementsJson}
          >
            Verify Premade Stock
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
