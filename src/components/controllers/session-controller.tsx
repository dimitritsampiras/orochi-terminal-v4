"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { SessionOrdersTable } from "@/components/table/session-orders-table";
import { orders, lineItems, shipments } from "@drizzle/schema";

type Order = typeof orders.$inferSelect & {
  shipments: (typeof shipments.$inferSelect)[];
  lineItems: (typeof lineItems.$inferSelect)[];
  isInShippingDoc: boolean;
};

interface SessionControllerProps {
  orders: Order[];
  sessionId?: number | string;
}

export function SessionController({ orders, sessionId }: SessionControllerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) {
      return orders;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();

    return orders.filter(
      (order) =>
        order.name.toLowerCase().includes(lowerSearchTerm) ||
        order.displayCustomerName?.toLowerCase().includes(lowerSearchTerm) ||
        order.displayDestinationCountryName?.toLowerCase().includes(lowerSearchTerm) ||
        order.lineItems.some((li) => li.name.toLowerCase().includes(lowerSearchTerm))
    );
  }, [orders, searchTerm]);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <Input
          placeholder="Search order, line items, customer, country"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-10 w-56 bg-white"
        />
      </div>

      <div className="mb-32 mt-4">
        <SessionOrdersTable orders={filteredOrders} sessionId={sessionId} />
      </div>
    </div>
  );
}
