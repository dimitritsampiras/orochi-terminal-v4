"use client";

import { type OrderQueue } from "@/lib/core/orders/get-order-queue";
import { useMemo, useState } from "react";
import { OrdersTable } from "../table/orders-table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { CreateSessionDialog } from "../dialog/create-session-dialog";
import dayjs from "dayjs";
import { blanks, blankVariants } from "@drizzle/schema";
import { FilterProductsFromQueueDialog } from "../dialog/filter-products-from-queue";
import { Badge } from "../ui/badge";

type CreateSessionControllerProps = {
  queue: OrderQueue;
  blankVariants: (typeof blankVariants.$inferSelect & {
    blank: typeof blanks.$inferSelect | null;
  })[];
};

export const CreateSessionController = ({ queue, blankVariants }: CreateSessionControllerProps) => {
  // Create a lookup map for blank variants by ID for O(1) access
  const blankVariantMap = new Map(blankVariants.map((bv) => [bv.id, bv]));

  const [orderQuantity, setOrderQuantity] = useState(50);
  const [filteredVariantIds, setFilteredVariantIds] = useState<Set<string>>(new Set());

  const handleOrderQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(e.target.value, 10);
    if (isNaN(value)) {
      setOrderQuantity(0);
    } else {
      setOrderQuantity(value);
    }
  };

  const handleArrowKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      setOrderQuantity((prev) => prev + 1);
    } else if (e.key === "ArrowDown") {
      setOrderQuantity((prev) => prev - 1);
    }
  };

  // Derived state: memoized slice of the queue
  const slicedOrders = useMemo(() => {
    let filteredQueue = queue;

    if (filteredVariantIds.size > 0) {
      filteredQueue = queue.filter((order) => {
        return order.lineItems.every((item) => item.productVariant && filteredVariantIds.has(item.productVariant.id));
      });
    }

    return filteredQueue.slice(0, orderQuantity);
  }, [queue, orderQuantity, filteredVariantIds]);

  // Derived state: memoized line item count
  const lineItemCount = useMemo(() => slicedOrders.flatMap((order) => order.lineItems ?? []).length, [slicedOrders]);

  // Derived state: orders with recent batches (last 7 days)
  const ordersWithRecentSessions = useMemo(() => {
    return slicedOrders.filter((order) => {
      // If there are no batches, this order is not of concern
      if (!order.batches || order.batches.length === 0) return false;

      // Sort batches by createdAt in descending order (most recent first)
      const sortedBatches = [...order.batches].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Get the most recent batch
      const mostRecent = sortedBatches[0];
      if (!mostRecent?.createdAt) return false;

      // Calculate the difference in days from now
      const timeDiff = Date.now() - new Date(mostRecent.createdAt).getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

      // Return true if the most recent batch was created within the last 7 days
      return daysDiff <= 7;
    });
  }, [slicedOrders]);

  const ordersWithOutOfStockItems = useMemo(() => {
    return slicedOrders.filter((order) => {
      return order.lineItems.some((item) => {
        const blankVariantId = item.productVariant?.blankVariantId;
        if (!blankVariantId) return false;

        const bv = blankVariantMap.get(blankVariantId);
        // Check if blank variant exists and quantity is 0
        return bv && bv.quantity <= 0;
      });
    });
  }, [slicedOrders, blankVariants]);

  return (
    <div>
      <div className="flex sm:flex-row flex-col items-center justify-between my-4">
        <div className="flex sm:w-auto w-full items-center gap-4 sm:mb-0 mb-4">
          <div className="relative">
            <Input
              value={orderQuantity}
              className="bg-white w-[10rem]"
              onChange={handleOrderQuantityChange}
              onKeyDown={handleArrowKeyPress}
            />
            <div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
              <div className="text-sm text-muted-foreground">orders</div>
            </div>
          </div>
          <div className="h-9 flex items-center justify-center text-sm font-medium">{lineItemCount} line items</div>
        </div>
        <div className="flex items-center justify-center gap-4">
          <FilterProductsFromQueueDialog onApply={(ids) => setFilteredVariantIds(new Set(ids))} />
          <CreateSessionDialog
            className="sm:w-auto w-full"
            numberOfOrders={orderQuantity}
            numberOfLineItems={lineItemCount}
            ordersWithRecentSessions={ordersWithRecentSessions}
          />
        </div>
      </div>
      {filteredVariantIds.size > 0 && (
        <div className="mb-4">
          <Badge variant="outline">Filtered by {filteredVariantIds.size} variants</Badge>
        </div>
      )}
      <OrdersTable orders={slicedOrders} />
    </div>
  );
};
