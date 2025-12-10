
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ScrollArea } from "@/components/ui/scroll-area";
import { type OrderQueue } from "@/lib/core/orders/get-order-queue";
import dayjs from "dayjs";
import Link from "next/link";
import { parseGid } from "@/lib/utils";

interface CreateSessionDialogProps {
  numberOfOrders: number;
  numberOfLineItems: number;
  ordersWithRecentSessions: OrderQueue;
  className?: string;
}

export function CreateSessionDialog({
  numberOfOrders,
  numberOfLineItems,
  ordersWithRecentSessions,
  className,
}: CreateSessionDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={className}>Create Session</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Session</DialogTitle>
          <DialogDescription>Review the session details below before creating.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm">
              Orders: <span className="font-medium">{numberOfOrders}</span>
            </div>
            <div className="text-sm">
              Line Items: <span className="font-medium">{numberOfLineItems}</span>
            </div>
          </div>

          {ordersWithRecentSessions.length > 0 && (
            <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
              <p className="mb-2 font-medium text-amber-800 text-sm">
                Warning: {ordersWithRecentSessions.length} orders have recent activity
              </p>
              <p className="mb-3 text-xs text-amber-700">
                The following orders have had sessions created within the past week. Please verify these orders being in
                the queue is intentional.
              </p>
              <ScrollArea className="h-40 w-full rounded-md border border-amber-200 bg-white">
                <div className="p-3">
                  {ordersWithRecentSessions.map((order) => (
                    <div key={order.id} className="mb-2 flex flex-col gap-1 text-xs last:mb-0">
                      <Link
                        className="font-medium text-amber-900 underline underline-offset-2 hover:no-underline"
                        href={`/orders/${parseGid(order.id)}`}
                        target="_blank"
                      >
                        Order {order.name}
                      </Link>
                      <div className="text-amber-700">
                        Session(s):{" "}
                        {order.batches?.map((b) => `${b.id} @ ${dayjs(b.createdAt).format("MMMM DD")}`).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit">Create Session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
