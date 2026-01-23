"use client";

import {
  inventoryTransactions as inventoryTransactionsTable,
  logs,
} from "@drizzle/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect & {
  log?: typeof logs.$inferSelect | null;
};
type Log = typeof logs.$inferSelect;

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  assembly_usage: { label: "Assembly", color: "bg-blue-100 text-blue-700" },
  manual_adjustment: {
    label: "Manual",
    color: "bg-purple-100 text-purple-700",
  },
  correction: { label: "Correction", color: "bg-amber-100 text-amber-700" },
  restock: { label: "Restock", color: "bg-emerald-100 text-emerald-700" },
  return: { label: "Return", color: "bg-teal-100 text-teal-700" },
  stock_take: { label: "Stock Take", color: "bg-gray-100 text-gray-700" },
  manual_print: {
    label: "Manual Print",
    color: "bg-indigo-100 text-indigo-700",
  },
  defected_item: { label: "Defect", color: "bg-red-100 text-red-700" },
};

export const InventoryTransactionItem = ({
  transaction,
  itemDisplayName,
  log,
}: {
  transaction: InventoryTransaction;
  itemDisplayName?: string;
  log?: Log | null;
}) => {
  const reasonInfo = REASON_LABELS[transaction.reason] ?? {
    label: transaction.reason,
    color: "bg-gray-100 text-gray-700",
  };
  const isPositive = transaction.changeAmount > 0;
  const isNegative = transaction.changeAmount < 0;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between items-start gap-3 rounded-lg border border-zinc-100 p-3 bg-zinc-50"
      )}
    >
      <div>
        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("text-[10px] px-1.5 py-0")} variant="outline">
              {reasonInfo.label}
            </Badge>
            <span className="text-xs text-zinc-400">
              {dayjs(transaction.createdAt).format("MMM D, h:mm A")}
            </span>
          </div>

          {/* Quantity change visualization */}
          <div className="mt-1.5 flex items-center gap-1.5 text-base">
            <span className="text-zinc-500">
              {transaction.previousQuantity}
            </span>
            <Icon icon="ph:arrow-right" className="size-3 text-zinc-400" />
            <span
              className={cn(
                "font-medium",
                isPositive && "text-emerald-600",
                isNegative && "text-red-600"
              )}
            >
              {transaction.newQuantity}
            </span>
          </div>
        </div>
        {itemDisplayName && (
          <div className="text-xs text-zinc-400">{itemDisplayName}</div>
        )}
      </div>
      {/* Type indicator */}
      <div className="flex items-center gap-2">
        <div className="text-xs text-zinc-400">
          {transaction.blankVariantId
            ? "Blank"
            : transaction.productVariantId
              ? "Product"
              : ""}
        </div>
        {isPositive ? (
          <Icon icon="ph:caret-up" className="size-3 text-emerald-600" />
        ) : isNegative ? (
          <Icon icon="ph:caret-down" className="size-3 text-red-600" />
        ) : null}
      </div>
      {log && (
        <div className="text-xs bg-zinc-100 text-zinc-700 px-2 py-1 rounded-md flex gap-2 w-full">
          <div className="text-zinc-500 font-medium text-xs">LOG:</div>
          {log.message}
        </div>
      )}
    </div>
  );
};

export const InventoryTransactionsList = ({
  transactions,
}: {
  transactions: InventoryTransaction[];
}) => {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center bg-zinc-50 text-zinc-500 rounded-lg text-sm">
        No inventory changes recorded
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div className="space-y-2 bg-zinc-50">
          <InventoryTransactionItem
            key={transaction.id}
            transaction={transaction}
            log={transaction.log}
          />
        </div>
      ))}
    </div>
  );
};

export const InventoryTransactionsCard = ({
  inventoryTransactions,
}: {
  inventoryTransactions: InventoryTransaction[];
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Inventory Changes</CardTitle>
        <CardDescription className="text-xs">
          {inventoryTransactions.length} changes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InventoryTransactionsList transactions={inventoryTransactions} />
      </CardContent>
    </Card>
  );
};
