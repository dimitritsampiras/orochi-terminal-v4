"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { batches, orders } from "@drizzle/schema";

import { QueueStatusBadge } from "../badges/queue-status-badge";
import dayjs from "dayjs";
import { CountryFlag } from "../country-flag";
import { parseGid, truncate } from "@/lib/utils";
import { FulfillmentPriorityBadge } from "../badges/fulfillment-priority-badge";
import { ShippingPriorityBadge } from "../badges/shipping-priority-badge";
import { FulfillmentStatusBadge } from "../badges/fulfillment-status-badge";
import { useRouter } from "next/navigation";

import { useProgress } from "@bprogress/next";
import { Progress } from "../ui/progress";
import { ActiveBadge } from "../badges/active-badge";
import { storedAssemblyLineSchema } from "@/lib/schemas/assembly-schema";

type Session = Pick<
  typeof batches.$inferSelect,
  "id" | "active" | "createdAt" | "assemblyLineJson"
> & {
  orders: Pick<typeof orders.$inferSelect, "id" | "displayFulfillmentStatus">[];
};

function SessionsTable({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const { start } = useProgress();

  const handleRowClick = (id: number) => {
    start();
    router.push(`/sessions/${id}`);
    // The progress will automatically complete when navigation finishes
  };

  return (
    <>
      <div className="@container/table bg-white rounded-lg shadow-sm border border-zinc-200 w-full">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Session #</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Line Items</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length > 0 ? (
              sessions.map(
                ({ id, createdAt, orders, active, assemblyLineJson }) => {
                  const { success, data } = storedAssemblyLineSchema
                    .array()
                    .safeParse(JSON.parse(assemblyLineJson ?? "[]"));
                  return (
                    <TableRow
                      key={id}
                      onClick={() => handleRowClick(id)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <TableCell className="font-semibold">{id}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {dayjs(createdAt).format("MMM, DD YYYY")}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {orders.length}
                      </TableCell>
                      <TableCell className="text-zinc-800">
                        {success ? `${data?.length} line items` : '-'}
                      </TableCell>
                      <TableCell>
                        <Progress
                          color="emerald"
                          value={
                            (orders.filter(
                              (order) =>
                                order.displayFulfillmentStatus === "FULFILLED"
                            ).length /
                              orders.length) *
                            100
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <ActiveBadge status={active} />
                      </TableCell>
                    </TableRow>
                  );
                }
              )
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  <p className="text-sm text-muted-foreground py-4">
                    No batches found
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

export { SessionsTable };
