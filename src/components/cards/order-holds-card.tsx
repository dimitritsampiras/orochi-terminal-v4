"use client";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { OrderHoldsTable, type OrderHold } from "../table/order-holds-table";
import { Icon } from "@iconify/react";

interface OrderHoldsCardProps {
  holds: OrderHold[];
}

export function OrderHoldsCard({ holds }: OrderHoldsCardProps) {
  const activeHolds = holds.filter((h) => !h.resolvedAt);
  const hasActiveHolds = activeHolds.length > 0;

  if (holds.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold">Order Holds</h3>
      </div>
      <OrderHoldsTable holds={holds} hideOrderColumn />
    </div>
  );
}
