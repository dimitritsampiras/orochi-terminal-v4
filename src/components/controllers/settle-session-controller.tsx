"use client";

import { SettlementItem } from "@/lib/core/session/get-settlement-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Icon } from "@iconify/react";
import { InventoryTransactionItem } from "../cards/inventory-transactions";
import { LineItemStatusBadge } from "../badges/line-item-status-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "../ui/dropdown-menu";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import {
  UpdateLineItemStatusSchema,
  AdjustSettlementInventorySchema,
  SettleSessionSchema,
} from "@/lib/schemas/batch-schema";
import {
  UpdateLineItemStatusResponse,
  AdjustSettlementInventoryResponse,
  SettleSessionResponse,
} from "@/lib/types/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { lineItemCompletionStatus } from "@drizzle/schema";

export const SettleSessionController = ({
  initialData,
  batchId,
}: {
  initialData: SettlementItem[];
  batchId: number;
}) => {
  const router = useRouter();
  const [acknowledgedItems, setAcknowledgedItems] = useState<Set<string>>(new Set());

  // Dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SettlementItem | null>(null);

  // Form state
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusNotes, setStatusNotes] = useState("");
  const [inventoryChange, setInventoryChange] = useState<number>(0);
  const [inventoryNotes, setInventoryNotes] = useState("");

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async (input: UpdateLineItemStatusSchema) => {
      const res = await fetch(`/api/batches/${batchId}/settle/line-item-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as UpdateLineItemStatusResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to update status");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Line item status updated");
      setStatusDialogOpen(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const adjustInventoryMutation = useMutation({
    mutationFn: async (input: AdjustSettlementInventorySchema) => {
      const res = await fetch(`/api/batches/${batchId}/settle/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as AdjustSettlementInventoryResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to adjust inventory");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Inventory adjusted");
      setInventoryDialogOpen(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const settleSessionMutation = useMutation({
    mutationFn: async (input: SettleSessionSchema) => {
      const res = await fetch(`/api/batches/${batchId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as SettleSessionResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to settle session");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Session settled successfully");
      router.push(`/sessions/${batchId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpenStatusDialog = (item: SettlementItem) => {
    setSelectedItem(item);
    setNewStatus(item.lineItemStatus);
    setStatusNotes("");
    setStatusDialogOpen(true);
  };

  const handleOpenInventoryDialog = (item: SettlementItem) => {
    setSelectedItem(item);
    // Calculate the difference needed to match expected
    const expected = item.expectedStockChange?.change ?? 0;
    const actual = item.actualStockChange?.totalChangeAmount ?? 0;
    setInventoryChange(expected - actual);
    setInventoryNotes("");
    setInventoryDialogOpen(true);
  };

  const handleAcknowledge = (lineItemId: string) => {
    setAcknowledgedItems((prev) => new Set([...prev, lineItemId]));
  };

  const handleUnacknowledge = (lineItemId: string) => {
    setAcknowledgedItems((prev) => {
      const next = new Set(prev);
      next.delete(lineItemId);
      return next;
    });
  };

  const handleSubmitStatusChange = () => {
    if (!selectedItem || !newStatus) return;
    updateStatusMutation.mutate({
      lineItemId: selectedItem.lineItemId,
      newStatus: newStatus as (typeof lineItemCompletionStatus.enumValues)[number],
      notes: statusNotes || undefined,
    });
  };

  const handleSubmitInventoryAdjustment = () => {
    if (!selectedItem || !selectedItem.expectedStockChange) return;
    adjustInventoryMutation.mutate({
      targetType: selectedItem.expectedStockChange.inventoryType,
      targetId: selectedItem.expectedStockChange.inventoryTypeId,
      changeAmount: inventoryChange,
      lineItemId: selectedItem.lineItemId,
      notes: inventoryNotes || undefined,
    });
  };

  // Check if all items are resolved
  const allResolved = initialData.every((item) => {
    const hasStatusDiscrepancy =
      (item.expectedFulfillmentType === "print" && item.lineItemStatus !== "printed") ||
      (item.expectedFulfillmentType === "stock" && item.lineItemStatus !== "in_stock") ||
      (item.expectedFulfillmentType === "black_label" &&
        ["printed", "partially_printed", "not_printed", "in_stock"].includes(item.lineItemStatus));

    const hasStockDiscrepancy = item.actualStockChange?.isMismatchedWithExpected;
    const isAcknowledged = acknowledgedItems.has(item.lineItemId);

    // Item is resolved if no discrepancy or it's been acknowledged
    return (!hasStatusDiscrepancy && !hasStockDiscrepancy) || isAcknowledged;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 shadow-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Line Item</TableHead>
              <TableHead>Expected Fulfillment Type</TableHead>
              <TableHead>Expected Inventory Change</TableHead>
              <TableHead>Actual Stock Changes</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.map((item) => {
              const hasStatusDiscrepancy =
                (item.expectedFulfillmentType === "print" && item.lineItemStatus !== "printed") ||
                (item.expectedFulfillmentType === "stock" && item.lineItemStatus !== "in_stock") ||
                (item.expectedFulfillmentType === "black_label" &&
                  ["printed", "partially_printed", "not_printed", "in_stock"].includes(item.lineItemStatus));

              const hasStockChangeDiscrepancy = item.actualStockChange?.isMismatchedWithExpected;
              const hasDiscrepancy = hasStatusDiscrepancy || hasStockChangeDiscrepancy;
              const isAcknowledged = acknowledgedItems.has(item.lineItemId);

              return (
                <TableRow key={item.lineItemId} className={cn(isAcknowledged && "opacity-50")}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.lineItemName}</div>
                      <div className="text-sm text-muted-foreground">{item.orderName}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      <ExpectedFulfillmentTypeBadge fulfillmentType={item.expectedFulfillmentType ?? "unaccounted"} />
                      <div className="text-zinc-400">|</div>
                      <LineItemStatusBadge status={item.lineItemStatus} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="bg-zinc-50 rounded-lg py-1 px-3 w-fit">
                      {item.expectedStockChange && item.expectedFulfillmentType !== "black_label" && (
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="text-lg font-medium">{item.expectedStockChange?.change}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-zinc-900 font-medium">
                                {item.expectedStockChange?.inventoryType === "blankVariant" ? "Blank" : "Product"}
                              </div>
                              {item.expectedStockChange.inventoryType === "productVariant" && (
                                <div className="size-1 bg-blue-500 rounded-full" />
                              )}
                            </div>
                            <div className="text-xs text-zinc-600">{item.expectedStockChange?.inventoryDisplayName}</div>
                          </div>
                        </div>
                      )}
                      {item.expectedFulfillmentType === "black_label" && (
                        <div className="text-sm text-indigo-700">Product Is Black Label</div>
                      )}
                      {(item.expectedFulfillmentType === "unaccounted" || item.expectedFulfillmentType === null) && (
                        <div className="text-sm text-red-600">Unaccounted</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {item.actualStockChange && (
                        <div>
                          <div className="text-muted-foreground text-xs">Total Stock Change</div>
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "text-lg font-medium",
                                item.actualStockChange.isMismatchedWithExpected && "text-red-700"
                              )}
                            >
                              {item.actualStockChange.totalChangeAmount}
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  disabled={!item.actualStockChange?.changes.length}
                                >
                                  <Icon icon="ph:eye" className="size-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Actual Stock Changes</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3">
                                  {item.actualStockChange?.changes.map(({ transaction }) => (
                                    <InventoryTransactionItem
                                      key={transaction.id}
                                      transaction={transaction}
                                      itemDisplayName={item.expectedStockChange?.inventoryDisplayName}
                                    />
                                  ))}
                                </div>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Close</Button>
                                  </DialogClose>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {hasDiscrepancy && !isAcknowledged ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Settle Discrepancy
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {hasStatusDiscrepancy && (
                              <DropdownMenuItem onClick={() => handleOpenStatusDialog(item)}>
                                Change Line Item Status
                              </DropdownMenuItem>
                            )}
                            {hasStockChangeDiscrepancy && (
                              <DropdownMenuItem onClick={() => handleOpenInventoryDialog(item)}>
                                Adjust Inventory
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleAcknowledge(item.lineItemId)}>
                              Acknowledge (This is fine)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                      {isAcknowledged && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                          onClick={() => handleUnacknowledge(item.lineItemId)}
                        >
                          Acknowledged
                          <Icon icon="ph:x" className="size-3 ml-1" />
                        </Button>
                      )}
                      {hasDiscrepancy && !isAcknowledged && (
                        <Icon icon="ph:warning-circle" className="size-4 text-yellow-500" />
                      )}
                      {!hasDiscrepancy && <Icon icon="ph:check-circle" className="size-4 text-emerald-500" />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Settle Session Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => settleSessionMutation.mutate({})}
          disabled={!allResolved || settleSessionMutation.isPending}
        >
          {settleSessionMutation.isPending ? "Settling..." : "Settle Session"}
        </Button>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Line Item Status</DialogTitle>
            <DialogDescription>Update the status for: {selectedItem?.lineItemName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {lineItemCompletionStatus.enumValues.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Reason for status change..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitStatusChange} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Adjustment Dialog */}
      <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
            <DialogDescription>
              Adjust inventory for: {selectedItem?.expectedStockChange?.inventoryDisplayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              Expected: {selectedItem?.expectedStockChange?.change} | Actual:{" "}
              {selectedItem?.actualStockChange?.totalChangeAmount ?? 0}
            </div>
            <div className="space-y-2">
              <Label>Adjustment Amount</Label>
              <Input
                type="number"
                value={inventoryChange}
                onChange={(e) => setInventoryChange(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Positive to add stock, negative to remove stock
              </p>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={inventoryNotes}
                onChange={(e) => setInventoryNotes(e.target.value)}
                placeholder="Reason for adjustment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInventoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitInventoryAdjustment} disabled={adjustInventoryMutation.isPending}>
              {adjustInventoryMutation.isPending ? "Adjusting..." : "Adjust Inventory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const ExpectedFulfillmentTypeBadge = ({
  fulfillmentType,
}: {
  fulfillmentType: NonNullable<SettlementItem["expectedFulfillmentType"]>;
}) => {
  const colorMap: Record<NonNullable<SettlementItem["expectedFulfillmentType"]>, string> = {
    stock: "bg-blue-100 text-blue-800",
    print: "bg-emerald-100 text-emerald-800",
    black_label: "bg-indigo-100 text-indigo-800",
    unaccounted: "bg-slate-100 text-slate-800",
  };
  return (
    <Badge variant="secondary" className={cn(colorMap[fulfillmentType], "capitalize")}>
      {fulfillmentType.toLowerCase().replaceAll("_", " ")}
    </Badge>
  );
};
