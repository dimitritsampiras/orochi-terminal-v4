"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { orders, products, productVariants } from "@drizzle/schema";

import { QueueStatusBadge } from "../badges/queue-status-badge";
import dayjs from "dayjs";
import { CountryFlag } from "../country-flag";
import { cn, parseGid, truncate } from "@/lib/utils";
import { FulfillmentPriorityBadge } from "../badges/fulfillment-priority-badge";
import { ShippingPriorityBadge } from "../badges/shipping-priority-badge";
import { FulfillmentStatusBadge } from "../badges/fulfillment-status-badge";
import { useRouter } from "next/navigation";

import { useProgress } from "@bprogress/next";
import { ProductStatusBadge } from "../badges/product-status-badge";
import { ProductSyncStatusBadge } from "../badges/product-sync-status-badge";
import { Icon } from "@iconify/react";

type Product = typeof products.$inferSelect & {
  productVariants: (typeof productVariants.$inferSelect)[];
};

function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const { start } = useProgress();

  const handleRowClick = (id: string) => {
    start();
    router.push(`/products/${parseGid(id)}`);
  };

  return (
    <>
      <div className="@container/table bg-white rounded-lg shadow-sm border border-zinc-200 w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Inventory</TableHead>
              <TableHead>Sync Status</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length > 0 ? (
              products.map(({ title, productVariants: variants, status, isBlackLabel, id }) => {
                const inventory = variants.reduce((acc, variant) => acc + variant.warehouseInventory, 0);

                const variantsCount = variants.length;
                const syncedCount = variants.filter((v) => Boolean(v.blankVariantId)).length;

                let productSyncStatus: "not_synced" | "partially_synced" | "synced" = "not_synced";

                title.includes("Citadel") && console.log(title, "syncedCount", syncedCount, variants);

                if (variantsCount > 0) {
                  if (syncedCount === variantsCount) {
                    productSyncStatus = "synced";
                  } else if (syncedCount > 0) {
                    productSyncStatus = "partially_synced";
                  }
                }

                return (
                  <TableRow key={id} onClick={() => handleRowClick(id)} className="cursor-pointer hover:bg-zinc-50">
                    <TableCell className="font-semibold">{title}</TableCell>

                    {isBlackLabel ? (
                      <TableCell className="font-semibold flex items-center gap-2">
                        <Icon icon="ph:storefront" />
                        Inventory Tracked By Shopify
                      </TableCell>
                    ) : (
                      <TableCell
                        className={cn(
                          "font-medium",
                          inventory === 0 && "text-zinc-600",
                          inventory >= 1 && "text-blue-800 font-semibold"
                        )}
                      >
                        {inventory} available across {variants.length} variants
                      </TableCell>
                    )}

                    <TableCell>
                      <ProductSyncStatusBadge status={productSyncStatus} isBlackLabel={isBlackLabel} />
                    </TableCell>
                    <TableCell>
                      <ProductStatusBadge status={status} />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="flex justify-end">
                <TableCell colSpan={8} className="text-center">
                  <p className="text-sm text-muted-foreground py-4">No orders found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export { ProductsTable };
