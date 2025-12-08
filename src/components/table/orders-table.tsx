"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { orders } from "@drizzle/schema";

import { QueueStatusBadge } from "../badges/queue-status-badge";
import dayjs from "dayjs";
import { CountryFlag } from "../country-flag";
import { parseGid, truncate } from "@/lib/utils";
import { FulfillmentPriorityBadge } from "../badges/fulfillment-priority-badge";
import { ShippingPriorityBadge } from "../badges/shipping-priority-badge";
import { FulfillmentStatusBadge } from "../badges/fulfillment-status-badge";
import { useRouter } from "next/navigation";

import { useProgress } from "@bprogress/next";

type Order = Pick<
  typeof orders.$inferSelect,
  | "name"
  | "createdAt"
  | "displayCustomerName"
  | "displayDestinationCountryCode"
  | "displayDestinationCountryName"
  | "displayFulfillmentStatus"
  | "fulfillmentPriority"
  | "queued"
  | "id"
  | "shippingPriority"
>;

function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const { start } = useProgress();

  const handleRowClick = (id: string) => {
    start();
    router.push(`/orders/${parseGid(id)}`);
    // The progress will automatically complete when navigation finishes
  };

  return (
    <>
      <div className="@container/table bg-white rounded-lg shadow-sm border border-zinc-200 w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Queue Status</TableHead>
              <TableHead>Fulfillment Priority</TableHead>
              <TableHead>Shipping Priority</TableHead>
              <TableHead>Fulfillment Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length > 0 ? (
              orders.map(
                ({
                  name,
                  displayCustomerName,
                  createdAt,
                  displayDestinationCountryCode,
                  displayDestinationCountryName,
                  queued,
                  fulfillmentPriority,
                  shippingPriority,
                  displayFulfillmentStatus,
                  id,
                }) => (
                  <TableRow key={id} onClick={() => handleRowClick(id)} className="cursor-pointer hover:bg-zinc-50">
                    <TableCell className="font-semibold">{name}</TableCell>
                    <TableCell className="text-muted-foreground">{dayjs(createdAt).format("MMM, DD YYYY")}</TableCell>
                    <TableCell className="font-medium">{truncate(displayCustomerName || "", 20)}</TableCell>

                    <TableCell>
                      <CountryFlag
                        countryName={displayDestinationCountryName}
                        countryCode={displayDestinationCountryCode || ""}
                      />
                    </TableCell>
                    <TableCell>
                      <QueueStatusBadge queued={queued} />
                    </TableCell>
                    <TableCell>
                      <FulfillmentPriorityBadge status={fulfillmentPriority} />
                    </TableCell>
                    <TableCell>
                      <ShippingPriorityBadge status={shippingPriority} />
                    </TableCell>
                    <TableCell>
                      <FulfillmentStatusBadge status={displayFulfillmentStatus} />
                    </TableCell>
                  </TableRow>
                )
              )
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
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

export { OrdersTable };
