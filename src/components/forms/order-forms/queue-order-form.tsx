"use client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseGid } from "@/lib/utils";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { type EditOrderSchema } from "@/lib/schemas/order-schema";

type QueueOrderFormProps = {
  orderId: string;
  currentQueueStatus: boolean;
  hasActiveHold?: boolean;
};

export const QueueOrderForm = ({
  orderId,
  currentQueueStatus,
  hasActiveHold,
}: QueueOrderFormProps) => {
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
      <Button
        variant="outline"
        onClick={() => handleQueueOrder(false)}
        loading={isLoading}
      >
        Unqueue Order
      </Button>
    );
  }

  const queueButton = (
    <Button
      className="bg-lime-600 hover:bg-lime-700 active:bg-lime-700"
      onClick={() => handleQueueOrder(true)}
      loading={isLoading}
      disabled={hasActiveHold}
    >
      Queue Order
    </Button>
  );

  if (hasActiveHold) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">{queueButton}</span>
        </TooltipTrigger>
        <TooltipContent>
          Cannot queue order with an active hold
        </TooltipContent>
      </Tooltip>
    );
  }

  return queueButton;
};
