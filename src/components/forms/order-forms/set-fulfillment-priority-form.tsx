"use client";

import { FulfillmentPriorityBadge } from "@/components/badges/fulfillment-priority-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { EditOrderSchema } from "@/lib/schemas/order-schema";
import { cn, parseGid } from "@/lib/utils";
import { fulfillmentPriority } from "@drizzle/schema";

interface SetFulfillmentPriorityFormProps {
  currentPriority: (typeof fulfillmentPriority.enumValues)[number];
  orderId: string;
  className?: string;
}

export const SetFulfillmentPriorityForm = ({
  currentPriority,
  orderId,
  className,
}: SetFulfillmentPriorityFormProps) => {
  const { isLoading, trigger } = useFetcher<EditOrderSchema>({
    path: `/api/orders/${parseGid(orderId)}`,
    method: "PATCH",
    successMessage: "Fulfillment priority updated successfully",
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" loading={isLoading} className={cn("bg-white! hover:bg-zinc-100!", className)}>
          <FulfillmentPriorityBadge status={currentPriority} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {fulfillmentPriority.enumValues.map((priority) => (
          <DropdownMenuItem
            key={priority}
            onClick={() => trigger({ fulfillmentPriority: priority })}
            disabled={isLoading || currentPriority === priority}
          >
            <FulfillmentPriorityBadge status={priority} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
