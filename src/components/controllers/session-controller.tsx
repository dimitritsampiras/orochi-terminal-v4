"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { SessionOrdersTable } from "@/components/table/session-orders-table";
import { orders, lineItems, shipments, batchDocuments } from "@drizzle/schema";
import { SessionDocumentsTable } from "../table/session-documents-table";
import { Icon } from "@iconify/react";
import { buttonVariants } from "../ui/button";

type Order = typeof orders.$inferSelect & {
  shipments: (typeof shipments.$inferSelect)[];
  lineItems: (typeof lineItems.$inferSelect)[];
  isInShippingDoc: boolean;
};

interface SessionControllerProps {
  orders: Order[];
  batchDocuments: (typeof batchDocuments.$inferSelect)[];
  sessionId?: number | string;
}

export function SessionController({ orders, sessionId, batchDocuments }: SessionControllerProps) {
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
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "default" })}>
            Generate Documents
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Merged Packing Slips</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Team</DropdownMenuItem>
            <DropdownMenuItem>Subscription</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {batchDocuments && batchDocuments.length > 0 && (
        <SessionDocumentsTable documents={batchDocuments} className="mb-8" />
      )}

      <div className="mb-32 mt-4">
        <SessionOrdersTable orders={filteredOrders} sessionId={sessionId} />
      </div>
    </div>
  );
}
