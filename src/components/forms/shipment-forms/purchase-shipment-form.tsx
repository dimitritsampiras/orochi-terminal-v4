"use client";

import { Button } from "@/components/ui/button";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { PurchaseShipmentSchema } from "@/lib/schemas/order-schema";
import { parseGid } from "@/lib/utils";

export const PurchaseShipmentForm = ({
  databaseShipmentUUID,
  orderId,
}: {
  databaseShipmentUUID: string;
  orderId: string;
}) => {
  const { isLoading, trigger } = useFetcher<PurchaseShipmentSchema>({
    path: `/api/orders/${parseGid(orderId)}/shipments/${databaseShipmentUUID}/purchase`,
    method: "POST",
    successMessage: "Shipment purchased successfully",
  });

  return (
    <Button variant="outline" onClick={() => trigger()} loading={isLoading}>
      Purchase
    </Button>
  );
};
