"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CountryFlag } from "@/components/country-flag";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { cn, getCarrierImage } from "@/lib/utils";
import { shipments } from "@drizzle/schema";

type Shipment = typeof shipments.$inferSelect;

export type ShipmentStatus = "none" | "unpurchased" | "purchased" | "refunded";

export interface OrderForBulkShipment {
  id: string;
  name: string;
  displayCustomerName: string | null;
  displayDestinationCountryCode: string | null;
  displayDestinationCountryName: string | null;
  shipments: Shipment[];
}

export interface SelectedOrder {
  orderId: string;
  orderName: string;
  status: ShipmentStatus;
  shipmentId?: string; // Only for unpurchased/refunded orders
}

interface BulkShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderForBulkShipment[];
  sessionId: number;
  onConfirm: (selectedOrders: SelectedOrder[]) => void;
}

function getShipmentStatus(shipmentsList: Shipment[]): ShipmentStatus {
  if (shipmentsList.length === 0) return "none";

  // Get the most recent shipment
  const sorted = [...shipmentsList].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latest = sorted[0];

  if (latest.isRefunded) return "refunded";
  if (latest.isPurchased) return "purchased";
  return "unpurchased";
}

function getLatestShipmentId(shipmentsList: Shipment[]): string | undefined {
  if (shipmentsList.length === 0) return undefined;
  const sorted = [...shipmentsList].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return sorted[0].id;
}

export function BulkShipmentDialog({
  open,
  onOpenChange,
  orders,
  sessionId,
  onConfirm,
}: BulkShipmentDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Compute order data with shipment status
  const orderData = useMemo(() => {
    return orders.map((order) => ({
      ...order,
      status: getShipmentStatus(order.shipments),
      latestShipmentId: getLatestShipmentId(order.shipments),
    }));
  }, [orders]);

  // Group orders by status
  const counts = useMemo(() => {
    return {
      none: orderData.filter((o) => o.status === "none").length,
      unpurchased: orderData.filter((o) => o.status === "unpurchased").length,
      purchased: orderData.filter((o) => o.status === "purchased").length,
      refunded: orderData.filter((o) => o.status === "refunded").length,
    };
  }, [orderData]);

  // Selectable orders (not purchased)
  const selectableOrders = useMemo(() => {
    return orderData.filter((o) => o.status !== "purchased");
  }, [orderData]);

  const handleSelectAll = (status: ShipmentStatus | "all") => {
    const toSelect =
      status === "all"
        ? selectableOrders
        : orderData.filter((o) => o.status === status && o.status !== "purchased");

    setSelectedIds((prev) => {
      const next = new Set(prev);
      toSelect.forEach((o) => next.add(o.id));
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleToggle = (orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selected: SelectedOrder[] = orderData
      .filter((o) => selectedIds.has(o.id))
      .map((o) => ({
        orderId: o.id,
        orderName: o.name,
        status: o.status,
        shipmentId: o.latestShipmentId,
      }));
    onConfirm(selected);
    onOpenChange(false);
  };

  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Purchase Shipments</DialogTitle>
          <DialogDescription>
            Select orders to purchase shipments for. Orders with purchased shipments are disabled.
          </DialogDescription>
        </DialogHeader>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectAll("none")}
            disabled={counts.none === 0}
          >
            No shipment ({counts.none})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectAll("unpurchased")}
            disabled={counts.unpurchased === 0}
          >
            Unpurchased ({counts.unpurchased})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectAll("refunded")}
            disabled={counts.refunded === 0}
          >
            Refunded ({counts.refunded})
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
            Clear
          </Button>
        </div>

        {/* Order table */}
        <div className="flex-1 overflow-y-auto border rounded-md bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      selectedCount === selectableOrders.length && selectableOrders.length > 0
                        ? true
                        : selectedCount > 0
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleSelectAll("all");
                      } else {
                        handleDeselectAll();
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Shipment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderData.map((order, index) => {
                const isPurchased = order.status === "purchased";
                const isSelected = selectedIds.has(order.id);

                return (
                  <TableRow
                    key={order.id}
                    className={cn(
                      isPurchased ? "opacity-50" : "hover:bg-gray-100 cursor-pointer",
                      index % 2 === 0 && "bg-gray-50"
                    )}
                    onClick={() => !isPurchased && handleToggle(order.id)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggle(order.id)}
                        disabled={isPurchased}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="font-semibold">{order.name}</TableCell>
                    <TableCell>{order.displayCustomerName || "—"}</TableCell>
                    <TableCell>
                      <CountryFlag
                        countryName={order.displayDestinationCountryName}
                        countryCode={order.displayDestinationCountryCode || ""}
                      />
                    </TableCell>
                    <TableCell>
                      <ShipmentCell shipments={order.shipments} status={order.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">
              {counts.purchased > 0 && `${counts.purchased} orders with purchased shipments excluded`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={selectedCount === 0}>
                Purchase {selectedCount} Shipment{selectedCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShipmentCell({ shipments: shipmentsList, status }: { shipments: Shipment[]; status: ShipmentStatus }) {
  if (shipmentsList.length === 0) {
    return <span className="text-muted-foreground">No shipment</span>;
  }

  // Check if all shipments are refunded
  if (shipmentsList.every((s) => s.isRefunded)) {
    return <span className="text-red-500">Refunded</span>;
  }

  // Get the last non-refunded shipment for carrier info
  const activeShipments = shipmentsList.filter((s) => !s.isRefunded);
  const lastActiveShipment = activeShipments[activeShipments.length - 1];

  return (
    <div className="flex items-center gap-2">
      {lastActiveShipment?.chosenCarrierName && (
        <Image
          src={getCarrierImage(lastActiveShipment.chosenCarrierName) || ""}
          alt={lastActiveShipment.chosenCarrierName}
          width={16}
          height={16}
          className="h-4 w-4"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      {shipmentsList.some((s) => s.isPurchased) ? (
        <Icon icon="ph:check-circle" className="size-4 text-green-600" />
      ) : (
        <Icon icon="ph:warning-circle" className="size-4 text-slate-500" />
      )}
      <span className={status === "purchased" ? "text-green-600" : ""}>
        {status === "purchased" ? "Purchased" : "Unpurchased"}
      </span>
    </div>
  );
}
