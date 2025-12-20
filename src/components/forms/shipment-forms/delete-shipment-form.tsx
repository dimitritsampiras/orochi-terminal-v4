"use client";

import { Button } from "@/components/ui/button";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { parseGid } from "@/lib/utils";
import { Icon } from "@iconify/react";

export const DeleteShipmentForm = ({ shipmentId, orderId }: { shipmentId: string; orderId: string }) => {
  const { isLoading, trigger } = useFetcher({
    path: `/api/orders/${parseGid(orderId)}/shipments/${shipmentId}/delete`,
    method: "POST",
    successMessage: "Shipment deleted successfully",
  });

  return (
    <Button variant="outline" size="icon" onClick={() => trigger()} loading={isLoading}>
      <Icon icon="ph:trash" className="size-4 text-red-600" />
    </Button>
  );
};
