"use client";

import { Button } from "@/components/ui/button";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { parseGid } from "@/lib/utils";

export const AutoCreateShipmentForm = ({ orderId }: { orderId: string }) => {
  const { isLoading, trigger } = useFetcher({
    path: `/api/orders/${parseGid(orderId)}/shipments`,
    method: "POST",
    successMessage: "Shipment created successfully",
    errorMessage: "Failed to create shipment",
  });

  return (
    <Button variant="outline" onClick={() => trigger()} loading={isLoading}>
      Auto-Create Shipment
    </Button>
  );
};
