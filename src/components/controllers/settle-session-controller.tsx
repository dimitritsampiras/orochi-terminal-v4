"use client";

import { SettlementItem } from "@/lib/core/session/get-settlement-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { cn, parseGid } from "@/lib/utils";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import { UpdateLineItemStatusSchema, AdjustSettlementInventorySchema } from "@/lib/schemas/batch-schema";
import { UpdateLineItemStatusResponse, AdjustSettlementInventoryResponse } from "@/lib/types/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { lineItemCompletionStatus } from "@drizzle/schema";
import { FulfillmentType } from "@/lib/core/session/create-picking-requirements";
import Link from "next/link";

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
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to update status");
      return data;
    },
    onSuccess: () => {
      toast.success("Status updated");
      setStatusDialogOpen(false);
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const adjustInventoryMutation = useMutation({
    mutationFn: async (input: AdjustSettlementInventorySchema) => {
      const res = await fetch(`/api/batches/${batchId}/settle/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as AdjustSettlementInventoryResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to adjust inventory");
      return data;
    },
    onSuccess: () => {
      toast.success("Inventory adjusted");
      setInventoryDialogOpen(false);
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleOpenStatusDialog = (item: SettlementItem) => {
    setSelectedItem(item);
    setNewStatus(item.currentStatus);
    setStatusNotes("");
    setStatusDialogOpen(true);
  };

  const handleOpenInventoryDialog = (item: SettlementItem) => {
    setSelectedItem(item);
    const expected = item.inventoryTarget?.expectedChange ?? 0;
    setInventoryChange(expected - item.actualInventoryChange);
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
    if (!selectedItem?.inventoryTarget) return;
    adjustInventoryMutation.mutate({
      targetType: selectedItem.inventoryTarget.type === "blank" ? "blankVariant" : "productVariant",
      targetId: selectedItem.inventoryTarget.id,
      changeAmount: inventoryChange,
      lineItemId: selectedItem.lineItemId,
      notes: inventoryNotes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Line Item</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expected Change</TableHead>
              <TableHead>Actual Change</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.map((item) => {
              const hasDiscrepancy = item.hasStatusMismatch || item.hasInventoryMismatch;
              const isAcknowledged = acknowledgedItems.has(item.lineItemId);

              return (
                <TableRow key={item.lineItemId} className={cn(isAcknowledged && "opacity-50")}>
                  <TableCell className="text-muted-foreground">{item.position + 1}</TableCell>
                  <TableCell>
                    <Link href={`/assembly/${parseGid(item.lineItemId)}`} className="font-medium text-wrap hover:underline">{item.lineItemName}</Link>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">{item.orderName}</div>
                  </TableCell>
                  <TableCell>
                    <FulfillmentBadge type={item.expectedFulfillment} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <LineItemStatusBadge status={item.currentStatus} />
                      {item.hasStatusMismatch && !isAcknowledged && (
                        <Icon icon="ph:warning" className="size-4 text-amber-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.inventoryTarget ? (
                      <div className="flex w-full bg-zinc-50 py-1 px-2 rounded-md flex-col">
                        <span
                          className={cn(
                            'text-base font-medium',
                          )}
                        >
                          {item.inventoryTarget.expectedChange}
                        </span>
                        <div className="text-xs text-muted-foreground">{item.inventoryTarget.displayName}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="h-full">
                    {item.inventoryTarget ? (
                      <div className="w-full py-1 px-2 flex gap-2 rounded-md">
                        <span
                          className={cn(
                            "text-base font-medium",
                            item.hasInventoryMismatch && !isAcknowledged && "text-red-600"
                          )}
                        >
                          {item.actualInventoryChange}
                        </span>
                        {item.transactions.length > 0 && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="icon-sm">
                                <Icon icon="ph:eye" className="size-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Inventory Transactions</DialogTitle>
                                <DialogDescription>{item.inventoryTarget.displayName}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {item.transactions.map((tx) => (
                                  <InventoryTransactionItem
                                    key={tx.id}
                                    transaction={tx}
                                    itemDisplayName={item.inventoryTarget?.displayName}
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
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}

                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {hasDiscrepancy && !isAcknowledged ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Fix
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {item.hasStatusMismatch && (
                              <DropdownMenuItem onClick={() => handleOpenStatusDialog(item)}>
                                Change Status
                              </DropdownMenuItem>
                            )}
                            {item.hasInventoryMismatch && item.inventoryTarget && (
                              <DropdownMenuItem onClick={() => handleOpenInventoryDialog(item)}>
                                Adjust Inventory
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleAcknowledge(item.lineItemId)}>
                              Acknowledge
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : isAcknowledged ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-amber-600"
                          onClick={() => handleUnacknowledge(item.lineItemId)}
                        >
                          <Icon icon="ph:check" className="size-3 mr-1" />
                          Ack'd
                        </Button>
                      ) : (
                        <Icon icon="ph:check-circle" className="size-4 text-emerald-500" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>{selectedItem?.lineItemName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-white!">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lineItemCompletionStatus.enumValues.map((status) => (
                    <SelectItem key={status} value={status}>
                      <LineItemStatusBadge status={status} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitStatusChange} loading={updateStatusMutation.isPending}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Dialog */}
      <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
            <DialogDescription>{selectedItem?.inventoryTarget?.displayName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              Expected: {selectedItem?.inventoryTarget?.expectedChange} | Actual: {selectedItem?.actualInventoryChange}
            </div>
            <div className="space-y-2">
              <Label>Adjustment</Label>
              <Input
                type="number"
                value={inventoryChange}
                onChange={(e) => setInventoryChange(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={inventoryNotes} onChange={(e) => setInventoryNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInventoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitInventoryAdjustment} loading={adjustInventoryMutation.isPending}>
              Adjust
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const FulfillmentBadge = ({ type }: { type: FulfillmentType }) => {
  const styles: Record<FulfillmentType, string> = {
    stock: "bg-blue-100 text-blue-800",
    print: "bg-emerald-100 text-emerald-800",
    black_label: "bg-indigo-100 text-indigo-800",
  };
  return (
    <Badge className={cn(styles[type], "capitalize")}>
      {type.replaceAll("_", " ")}
    </Badge>
  );
};
