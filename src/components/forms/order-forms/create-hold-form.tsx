"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { parseGid } from "@/lib/utils";
import type { CreateOrderHoldSchema } from "@/lib/schemas/order-hold-schema";
import { orderHoldCause } from "@drizzle/schema";
import { Icon } from "@iconify/react";
import { Label } from "@/components/ui/label";

interface CreateHoldFormProps {
  orderId: string;
}

const causeLabels: Record<(typeof orderHoldCause.enumValues)[number], string> = {
  address_issue: "Address Issue",
  shipping_issue: "Shipping Issue",
  stock_shortage: "Stock Shortage",
  other: "Other",
};

export function CreateHoldForm({ orderId }: CreateHoldFormProps) {
  const [open, setOpen] = useState(false);
  const [cause, setCause] = useState<(typeof orderHoldCause.enumValues)[number] | "">("");
  const [reasonNotes, setReasonNotes] = useState("");

  const { trigger, isLoading } = useFetcher<CreateOrderHoldSchema>({
    path: `/api/orders/${parseGid(orderId)}/holds`,
    method: "POST",
    successMessage: "Hold created successfully",
    errorMessage: "Failed to create hold",
    onSuccess: () => {
      setOpen(false);
      setCause("");
      setReasonNotes("");
    },
  });

  const handleSubmit = () => {
    if (cause && reasonNotes.trim()) {
      trigger({ cause, reasonNotes: reasonNotes.trim() });
    }
  };

  const isValid = cause && reasonNotes.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
          <Icon icon="ph:call-bell" className="size-4" />
          Add Hold
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Order Hold</DialogTitle>
          <DialogDescription>
            Create a hold on this order. The order will be flagged until the hold is resolved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cause">Cause</Label>
            <Select value={cause} onValueChange={(v) => setCause(v as typeof cause)}>
              <SelectTrigger id="cause">
                <SelectValue placeholder="Select a cause" />
              </SelectTrigger>
              <SelectContent>
                {orderHoldCause.enumValues.map((c) => (
                  <SelectItem key={c} value={c}>
                    {causeLabels[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason Notes</Label>
            <Textarea
              id="reason"
              placeholder="Describe the reason for this hold..."
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading} loading={isLoading}>
            Create Hold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

