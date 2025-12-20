"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { parseGid } from "@/lib/utils";
import { Icon } from "@iconify/react";

interface RefundShipmentFormProps {
  shipmentId: string;
  orderId: string;
}

export const RefundShipmentForm = ({ shipmentId, orderId }: RefundShipmentFormProps) => {
  const [open, setOpen] = useState(false);

  const { isLoading, trigger } = useFetcher({
    path: `/api/orders/${parseGid(orderId)}/shipments/${shipmentId}/refund`,
    method: "POST",
    successMessage: "Refund request submitted",
    onSuccess: () => setOpen(false),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon icon="ph:arrow-counter-clockwise" className="size-3" />
          Refund
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Refund Shipping Label</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to refund this shipping label? This will submit a refund request to the carrier. The
            refund may take a few days to process.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={() => trigger()} disabled={isLoading} loading={isLoading}>
            Refund Label
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
