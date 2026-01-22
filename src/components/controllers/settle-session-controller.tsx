"use client";

import { SettlementItem } from "@/lib/core/session/get-settlement-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import { cn, parseGid, sleep } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useMutation } from "@tanstack/react-query";
import {
  UpdateLineItemStatusSchema,
  AdjustSettlementInventorySchema,
} from "@/lib/schemas/batch-schema";
import {
  UpdateLineItemStatusResponse,
  AdjustSettlementInventoryResponse,
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
import { FulfillmentType } from "@/lib/core/session/create-picking-requirements";
import Link from "next/link";
import { SetLineItemStatusForm } from "../forms/order-forms/set-line-item-status-form";

export const SettleSessionController = ({
  initialData,
  batchId,
}: {
  initialData: SettlementItem[];
  batchId: number;
}) => {
  const router = useRouter();

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
      const res = await fetch(
        `/api/batches/${batchId}/settle/line-item-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const data = (await res.json()) as UpdateLineItemStatusResponse;
      if (!res.ok || data.error)
        throw new Error(data.error ?? "Failed to update status");
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
      if (!res.ok || data.error)
        throw new Error(data.error ?? "Failed to adjust inventory");
      return data;
    },
    onSuccess: async () => {
      setInventoryDialogOpen(false);
      router.refresh();
      await sleep(1000);
      toast.success("Inventory adjusted");
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

  const handleSubmitStatusChange = () => {
    if (!selectedItem || !newStatus) return;
    updateStatusMutation.mutate({
      lineItemId: selectedItem.lineItemId,
      newStatus:
        newStatus as (typeof lineItemCompletionStatus.enumValues)[number],
      notes: statusNotes || undefined,
    });
  };

  const handleSubmitInventoryAdjustment = () => {
    if (!selectedItem?.inventoryTarget) return;
    adjustInventoryMutation.mutate({
      targetType:
        selectedItem.inventoryTarget.type === "blank"
          ? "blankVariant"
          : "productVariant",
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
              <TableHead>Expected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.map((item) => {
              const hasDiscrepancy =
                item.hasStatusMismatch || item.hasInventoryMismatch;

              return (
                <TableRow key={item.lineItemId}>
                  <TableCell className="text-muted-foreground text-xs!">
                    {item.position + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/assembly/${parseGid(item.lineItemId)}`}
                        className="font-medium text-xs! text-wrap hover:underline"
                      >
                        {item.lineItemName.split("-").join("")}
                      </Link>
                      <Link
                        href={`/orders/${parseGid(item.orderId)}`}
                        className="text-xs! text-muted-foreground hover:underline"
                      >
                        {item.orderName}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    <FulfillmentBadge type={item.expectedFulfillment} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <LineItemStatusBadge
                        status={item.currentStatus}
                        className="text-[10px]! py-0.5! px-1.5!"
                      />
                      {item.hasStatusMismatch && (
                        <Icon
                          icon="ph:warning"
                          className="size-4 text-amber-500"
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.inventoryTarget ? (
                      <div className="flex w-full bg-zinc-50 py-1 px-2 rounded-md flex-row items-center gap-1 justify-between">
                        <span className={cn("text-sm font-medium")}>
                          {item.inventoryTarget.expectedChange}
                        </span>
                        <div className="text-[10px] text-muted-foreground">
                          {item.inventoryTarget.displayName.split("-").join("")}
                        </div>
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
                            item.hasInventoryMismatch && "text-red-600"
                          )}
                        >
                          {item.actualInventoryChange}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {(item.transactions.length > 0 ||
                        item.logs.length > 0) && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon-sm">
                              <Icon icon="ph:eye" className="size-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Activity Log</DialogTitle>
                              <DialogDescription>
                                {item.lineItemName}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                              {item.transactions.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Inventory Transactions (
                                    {item.transactions.length})
                                  </Label>
                                  <div className="space-y-1.5">
                                    {item.transactions.map((tx) => (
                                      <InventoryTransactionItem
                                        key={tx.id}
                                        transaction={tx}
                                        itemDisplayName={
                                          item.inventoryTarget?.displayName
                                        }
                                        log={tx.log}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {item.logs.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Line Item Logs ({item.logs.length})
                                  </Label>
                                  <div className="space-y-1.5">
                                    {item.logs.map((log) => (
                                      <LogItem key={log.id} log={log} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Close</Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                      <SetLineItemStatusForm
                        className="h-7 w-7"
                        lineItemId={item.lineItemId}
                        orderId={item.orderId}
                      />
                      {item.inventoryTarget && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenInventoryDialog(item)}
                        >
                          Adjust Inventory
                        </Button>
                      )}
                      {!hasDiscrepancy && (
                        <Icon
                          icon="ph:check-circle"
                          className="size-4 text-emerald-500"
                        />
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
              <Textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitStatusChange}
              loading={updateStatusMutation.isPending}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Dialog */}
      <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
            <DialogDescription>
              {selectedItem?.inventoryTarget?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Current state summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-zinc-50 rounded-md p-2">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-lg font-medium">
                  {selectedItem?.currentInventory ?? 0}
                </div>
              </div>
              <div className="bg-zinc-50 rounded-md p-2">
                <div className="text-xs text-muted-foreground">
                  Expected Change
                </div>
                <div className="text-lg font-medium">
                  {selectedItem?.inventoryTarget?.expectedChange ?? 0}
                </div>
              </div>
              <div className="bg-zinc-50 rounded-md p-2">
                <div className="text-xs text-muted-foreground">
                  Actual Change
                </div>
                <div
                  className={cn(
                    "text-lg font-medium",
                    selectedItem?.hasInventoryMismatch && "text-red-600"
                  )}
                >
                  {selectedItem?.actualInventoryChange ?? 0}
                </div>
              </div>
            </div>

            {/* Recent transactions */}
            {selectedItem && selectedItem.transactions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Recent Transactions ({selectedItem.transactions.length})
                </Label>
                <div className="max-h-32 overflow-y-auto space-y-1.5">
                  {selectedItem.transactions.slice(0, 5).map((tx) => (
                    <InventoryTransactionItem
                      key={tx.id}
                      transaction={tx}
                      log={tx.log}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Adjustment input */}
            <div className="space-y-2">
              <Label>Adjustment Amount</Label>
              <Input
                type="number"
                value={inventoryChange}
                onChange={(e) =>
                  setInventoryChange(parseInt(e.target.value) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                This will create a new transaction that changes inventory by{" "}
                <span
                  className={cn(
                    "font-medium",
                    inventoryChange > 0 && "text-emerald-600",
                    inventoryChange < 0 && "text-red-600"
                  )}
                >
                  {inventoryChange > 0 ? "+" : ""}
                  {inventoryChange}
                </span>
              </p>
            </div>

            {/* Preview */}
            <div className="flex items-center justify-center gap-2 p-3 bg-zinc-50 rounded-md">
              <span className="text-sm text-muted-foreground">
                {selectedItem?.currentInventory ?? 0}
              </span>
              <Icon icon="ph:arrow-right" className="size-4 text-zinc-400" />
              <span className="text-sm font-medium">
                {(selectedItem?.currentInventory ?? 0) + inventoryChange}
              </span>
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
            <Button
              variant="outline"
              onClick={() => setInventoryDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitInventoryAdjustment}
              loading={adjustInventoryMutation.isPending}
            >
              Create Transaction
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
    <Badge
      className={cn(styles[type], "capitalize text-[10px]! py-0.5! px-1.5!")}
    >
      {type.replaceAll("_", " ")}
    </Badge>
  );
};

const LogItem = ({
  log,
}: {
  log: { id: number; message: string; createdAt: Date; type: string };
}) => {
  const typeStyles: Record<string, string> = {
    INFO: "text-blue-600",
    WARN: "text-amber-600",
    ERROR: "text-red-600",
  };

  return (
    <div className="flex justify-between items-start gap-3 rounded-lg border border-zinc-100 p-3 bg-zinc-50">
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", typeStyles[log.type] ?? "text-zinc-700")}>
          {log.message}
        </p>
        <span className="text-xs text-zinc-400">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      </div>
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
        {log.type}
      </Badge>
    </div>
  );
};
