"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, parseGid } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { shipments, orderHolds } from "@drizzle/schema";

type Shipment = typeof shipments.$inferSelect;
type OrderHold = typeof orderHolds.$inferSelect;

export type ShipmentIssueType = "none" | "unpurchased" | "refunded" | "missing_label";

export interface OrderWithShippingIssue {
  id: string;
  name: string;
  displayCustomerName: string | null;
  shipments: Shipment[];
  orderHolds: OrderHold[];
}

interface ShippingIssuesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderWithShippingIssue[];
  sessionId: number;
}

function getShipmentIssue(shipmentsList: Shipment[]): { type: ShipmentIssueType; label: string } | null {
  if (shipmentsList.length === 0) {
    return { type: "none", label: "No shipment" };
  }

  // Check if all shipments are refunded
  if (shipmentsList.every((s) => s.isRefunded)) {
    return { type: "refunded", label: "Refunded" };
  }

  // Check if any shipment is not purchased
  const hasUnpurchased = shipmentsList.some((s) => !s.isPurchased && !s.isRefunded);
  if (hasUnpurchased) {
    return { type: "unpurchased", label: "Unpurchased" };
  }

  // Check for missing label slips on purchased shipments
  const hasMissingLabel = shipmentsList.some((s) => s.isPurchased && !s.isRefunded && !s.labelSlipPath);
  if (hasMissingLabel) {
    return { type: "missing_label", label: "Missing label" };
  }

  // No issues - fully purchased with labels
  return null;
}

export function ShippingIssuesDialog({ open, onOpenChange, orders, sessionId }: ShippingIssuesDialogProps) {
  const router = useRouter();

  // Filter to only orders with shipping issues
  const ordersWithIssues = useMemo(() => {
    return orders
      .map((order) => ({
        ...order,
        issue: getShipmentIssue(order.shipments),
        hasActiveHold: order.orderHolds.some((hold) => !hold.isResolved),
      }))
      .filter((order) => order.issue !== null);
  }, [orders]);

  const handleNavigate = (orderId: string) => {
    onOpenChange(false);
    router.push(`/orders/${parseGid(orderId)}?from=session&session_id=${sessionId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Shipping Issues</DialogTitle>
          <DialogDescription>
            {ordersWithIssues.length === 0
              ? "All orders have valid shipments."
              : `${ordersWithIssues.length} order${ordersWithIssues.length !== 1 ? "s" : ""} with shipping issues.`}
          </DialogDescription>
        </DialogHeader>

        {ordersWithIssues.length > 0 ? (
          <div className="flex-1 overflow-y-auto border rounded-md bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersWithIssues.map((order, index) => (
                  <TableRow key={order.id} className={cn(index % 2 === 0 && "bg-gray-50")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{order.name}</span>
                        {order.hasActiveHold && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">On Hold</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.displayCustomerName || "—"}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-sm",
                          order.issue?.type === "none" && "text-zinc-500",
                          order.issue?.type === "unpurchased" && "text-red-600",
                          order.issue?.type === "refunded" && "text-red-500",
                          order.issue?.type === "missing_label" && "text-amber-600"
                        )}
                      >
                        {order.issue?.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleNavigate(order.id)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">No shipping issues found.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
