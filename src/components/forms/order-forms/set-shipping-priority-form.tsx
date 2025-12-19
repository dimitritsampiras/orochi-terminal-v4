"use client";

import { ShippingPriorityBadge } from "@/components/badges/shipping-priority-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { EditOrderSchema } from "@/lib/schemas/order-schema";
import { cn, parseGid } from "@/lib/utils";
import { shippingPriority } from "@drizzle/schema";

interface SetShippingPriorityFormProps {
  currentPriority: (typeof shippingPriority.enumValues)[number];
  orderId: string;
  className?: string;
}

export const SetShippingPriorityForm = ({ currentPriority, orderId, className }: SetShippingPriorityFormProps) => {
  const { isLoading, trigger } = useFetcher<EditOrderSchema>({
    path: `/api/orders/${parseGid(orderId)}`,
    method: "PATCH",
    successMessage: "Shipping priority updated successfully",
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" loading={isLoading} className={cn("bg-white! hover:bg-zinc-100!", className)}>
          <ShippingPriorityBadge status={currentPriority} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {shippingPriority.enumValues.map((priority) => (
          <DropdownMenuItem
            key={priority}
            onClick={() => trigger({ shippingPriority: priority })}
            disabled={isLoading || currentPriority === priority}
          >
            <ShippingPriorityBadge status={priority} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
