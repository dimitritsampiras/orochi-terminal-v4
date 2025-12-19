"use client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { parseGid } from "@/lib/utils";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { type EditOrderSchema } from "@/lib/schemas/order-schema";

type QueueOrderFormProps = {
  orderId: string;
  currentQueueStatus: boolean;
};

export const QueueOrderForm = ({ orderId, currentQueueStatus }: QueueOrderFormProps) => {
  const { trigger, isLoading } = useFetcher<EditOrderSchema>({
    path: `/api/orders/${parseGid(orderId)}`,
    method: "PATCH",
    successMessage: "Order queued successfully",
    errorMessage: "Failed to queue order",
  });

  const handleQueueOrder = (targetQueueStatus: boolean) => {
    trigger({ queued: targetQueueStatus });
  };

  if (currentQueueStatus === true) {
    return (
      <Button variant="outline" onClick={() => handleQueueOrder(false)} loading={isLoading}>
        {isLoading && <Spinner className="mr-2" />}
        Unqueue Order
      </Button>
    );
  }

  return (
    <Button
      className="bg-lime-600 hover:bg-lime-700 active:bg-lime-700"
      onClick={() => handleQueueOrder(true)}
      loading={isLoading}
    >
      {isLoading && <Spinner className="mr-2" />}
      Queue Order
    </Button>
  );
};
