"use client";

import { Button } from "@/components/ui/button";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { parseGid } from "@/lib/utils";
import type { ResolveOrderHoldSchema } from "@/lib/schemas/order-hold-schema";
import { Icon } from "@iconify/react";

interface ResolveHoldButtonProps {
  holdId: number;
  orderId: string;
  disabled?: boolean;
}

export function ResolveHoldButton({ holdId, orderId, disabled }: ResolveHoldButtonProps) {
  const { trigger, isLoading } = useFetcher<ResolveOrderHoldSchema>({
    path: `/api/orders/${parseGid(orderId)}/holds/${holdId}/resolve`,
    method: "PATCH",
    successMessage: "Hold resolved successfully",
    errorMessage: "Failed to resolve hold",
  });

  const handleResolve = () => {
    trigger({});
  };

  return (
    <Button
      variant="fill"
      size="sm"
      onClick={handleResolve}
      disabled={disabled || isLoading}
      loading={isLoading}
      className="gap-1.5"
    >
      <Icon icon="ph:check-circle" className="size-4" />
      Resolve
    </Button>
  );
}

