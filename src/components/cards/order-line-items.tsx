"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { lineItemCompletionStatus, lineItems } from "@drizzle/schema";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { SetLineItemStatusForm } from "../forms/order-forms/set-line-item-status-form";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { LineItemStatusBadge } from "../badges/line-item-status-badge";

// Types
type LineItemStatus = (typeof lineItemCompletionStatus.enumValues)[number];

type LineItem = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>["lineItems"]["nodes"][number];

interface LineItemsCardProps {
  orderId: string;
  shopifyLineItems: LineItem[];
  databaseLineItems: (typeof lineItems.$inferSelect)[];
}

export function OrderLineItems({ orderId, shopifyLineItems, databaseLineItems }: LineItemsCardProps) {
  // Create a map for fast O(1) lookup of DB items
  const dbItemsMap = new Map(databaseLineItems.map((item) => [item.id, item]));

  // Sort: Unfulfilled first, then alphabetical
  const sortedItems = shopifyLineItems.toSorted((a, b) => {
    const unfulfillableDiff = b.unfulfilledQuantity - a.unfulfilledQuantity;
    if (unfulfillableDiff !== 0) return unfulfillableDiff;
    return a.name.localeCompare(b.name);
  }).filter((item) => item.requiresShipping);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Line Items</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sortedItems.map((shopifyItem, index) => {
          const dbItem = dbItemsMap.get(shopifyItem.id);
          // Only show if we have a matching DB record (or handle mismatch as needed)
          if (!dbItem) return null;

          return (
            <div key={shopifyItem.id}>
              <LineItemRow shopifyItem={shopifyItem} dbItem={dbItem} orderId={orderId} />
              {index < sortedItems.length - 1 && <hr className="my-3 border-gray-100" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LineItemRow({
  shopifyItem,
  dbItem,
  orderId,
}: {
  shopifyItem: LineItem;
  dbItem: typeof lineItems.$inferSelect;
  orderId: string;
}) {
  const isFulfilled = shopifyItem.unfulfilledQuantity <= 0;

  return (
    <div className={cn("flex flex-col gap-2", isFulfilled && "opacity-50")}>
      <div className="flex w-full items-center justify-between">
        {/* Left: Image & Details */}
        <div className="flex items-center gap-3">
          {shopifyItem.image?.url && (
            <img
              src={shopifyItem.image.url}
              alt={shopifyItem.title}
              className="h-12 min-w-12 rounded-md border object-cover"
            />
          )}
          <div className="flex flex-col">
            <Link
              href={`/products/${shopifyItem.product?.id?.split("/").pop()}`}
              className="font-medium hover:underline text-sm"
            >
              {shopifyItem.title}
            </Link>
            <span className="text-sm text-gray-500">
              {shopifyItem.variantTitle} • x{shopifyItem.quantity}
            </span>
          </div>
        </div>

        {/* Right: Actions & Status */}
        <div className="flex items-center gap-2">
          {dbItem.markedAsPackaged && (
            <Badge variant="outline">
              <div className="h-1.5 w-1.5 rounded-full bg-rose-600" />
              packaged
            </Badge>
          )}

          <LineItemStatusBadge status={dbItem.completionStatus} />

          <SetLineItemStatusForm lineItemId={dbItem.id} orderId={orderId} />
        </div>
      </div>

      {/* Footer: Status Messages */}
      <div className="flex flex-col gap-1 text-xs">
        {shopifyItem.nonFulfillableQuantity > 0 && (
          <span className="text-gray-400">Nonfulfillable Quantity: {shopifyItem.nonFulfillableQuantity}</span>
        )}

        {shopifyItem.unfulfilledQuantity > 0 ? (
          <span className="text-yellow-700 font-medium">Requires Fulfillment: {shopifyItem.unfulfilledQuantity}</span>
        ) : (
          <span className="text-emerald-600 font-medium">No fulfillment needed</span>
        )}

        {!shopifyItem.requiresShipping && <span className="text-gray-400">Unshippable</span>}

        {/* Example logic for Unsynced - adjust based on your exact data shape */}
        {!shopifyItem.product?.tracksInventory && <span className="text-gray-400">Unsynced</span>}
      </div>
    </div>
  );
}
