"use client";

import { AlertCircleIcon, Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { ScrollArea } from "@/components/ui/scroll-area";
import { type OrderQueue } from "@/lib/core/orders/get-order-queue";
import dayjs from "dayjs";
import Link from "next/link";
import { parseGid } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { CreateBatchSchema } from "@/lib/schemas/order-schema";
import { CreateBatchResponse } from "@/lib/types/api";

interface CreateSessionDialogProps {
  numberOfOrders: number;
  numberOfLineItems: number;
  ordersWithRecentSessions: OrderQueue;
  orderIds: string[];
  className?: string;
}

export function CreateSessionDialog({
  numberOfOrders,
  numberOfLineItems,
  ordersWithRecentSessions,
  orderIds,
  className,
}: CreateSessionDialogProps) {
  const router = useRouter();
  const [setAsActive, setSetAsActive] = useState(true);
  const [open, setOpen] = useState(false);

  const { trigger, isLoading } = useFetcher<CreateBatchSchema, CreateBatchResponse>({
    path: "/api/batches",
    method: "POST",
    successMessage: "Session created successfully",
    errorMessage: "Failed to create session",
    onSuccess: () => {
      setOpen(false);
      router.push("/sessions");
    },
  });

  const handleCreateSession = () => {
    trigger({ orderIds, setAsActive });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="setAsActive"
              checked={setAsActive}
              onCheckedChange={(checked) => setSetAsActive(checked === true)}
            />
            <Label htmlFor="setAsActive" className="text-sm font-medium leading-none cursor-pointer">
              Set as active session
            </Label>
          </div>

          {ordersWithRecentSessions.length > 0 && (
            <div className="p-4 rounded-md bg-white border border-zinc-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircleIcon size={16} color="oklch(55.5% 0.163 48.998)" />
                <div className="font-semibold text-sm">
                  Warning: {ordersWithRecentSessions.length} orders have recent activity
                </div>
              </div>

              <ScrollArea className="h-40 w-full">
                {ordersWithRecentSessions.map((order) => (
                  <Link
                    href={`/orders/${parseGid(order.id)}`}
                    key={order.id}
                    className="flex items-center justify-between bg-zinc-50 my-2 py-2 px-4 hover:bg-zinc-100 transition-colors cursor-pointer rounded-sm"
                  >
                    <div className="text-black text-sm">{order.name}</div>
                    <div className="text-muted-foreground text-sm">
                      {order.batches
                        ?.map((b) => `Session ${b.id} @ ${dayjs(b.createdAt).format("MMMM DD")}`)
                        .join(", ")}
                    </div>
                  </Link>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleCreateSession} disabled={isLoading || orderIds.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
