"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { parseGid } from "@/lib/utils";
import { Icon } from "@iconify/react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface ResolveHoldButtonProps {
  holdId: number;
  orderId: string;
  disabled?: boolean;
}

export function ResolveHoldButton({ holdId, orderId, disabled }: ResolveHoldButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [requeue, setRequeue] = useState(true);

  const mutation = useMutation({
    mutationFn: async (body: { resolvedNotes?: string; requeue: boolean }) => {
      const res = await fetch(`/api/orders/${parseGid(orderId)}/holds/${holdId}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to resolve hold");
      return data;
    },
    onSuccess: () => {
      toast.success("Hold resolved");
      setOpen(false);
      setNotes("");
      setRequeue(true);
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleResolve = () => {
    mutation.mutate({ resolvedNotes: notes || undefined, requeue });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="fill" size="sm" disabled={disabled} className="gap-1.5">
          <Icon icon="ph:check-circle" className="size-4" />
          Resolve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve Hold</DialogTitle>
          <DialogDescription>
            Confirm that the issue has been resolved and this order can proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="requeue"
              checked={requeue}
              onCheckedChange={(checked) => setRequeue(checked === true)}
            />
            <Label htmlFor="requeue" className="cursor-pointer">
              Add order back to queue
            </Label>
          </div>

          {!requeue && (
            <Alert variant="destructive">
              <Icon icon="ph:warning" className="size-4" />
              <AlertDescription>
                By not requeuing the order, it will remain sitting in it's current session. If the session has already started and it was on hold, this order would have been ignored.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Resolution Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How was this resolved?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleResolve} loading={mutation.isPending}>
            Resolve Hold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
