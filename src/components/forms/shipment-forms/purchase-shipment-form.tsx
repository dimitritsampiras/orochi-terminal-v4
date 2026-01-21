"use client";

import { Button } from "@/components/ui/button";
import { PurchaseShipmentResponse } from "@/lib/types/api";
import { parseGid, sleep } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export const PurchaseShipmentForm = ({
  databaseShipmentUUID,
  orderId,
}: {
  databaseShipmentUUID: string;
  orderId: string;
}) => {
  const router = useRouter();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/orders/${parseGid(orderId)}/shipments/${databaseShipmentUUID}/purchase`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = (await res.json()) as PurchaseShipmentResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to purchase shipment");
      }
      return data;
    },
    onSuccess: async () => {
      router.refresh();
      await sleep(1000);
      toast.success("Shipment purchased successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Button variant="outline" onClick={() => mutate()} loading={isPending}>
      Purchase
    </Button>
  );
};
