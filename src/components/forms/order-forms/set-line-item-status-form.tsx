import { LineItemStatusBadge } from "@/components/badges/line-item-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { EditLineItemSchema } from "@/lib/schemas/order-schema";
import { parseGid } from "@/lib/utils";
import { lineItemCompletionStatus } from "@drizzle/schema";
import { Icon } from "@iconify/react";

export const SetLineItemStatusForm = ({ lineItemId, orderId }: { lineItemId: string, orderId: string }) => {
  const { trigger, isLoading } = useFetcher<EditLineItemSchema>({
    path: `/api/orders/${parseGid(orderId)}/line-items/${parseGid(lineItemId)}`,
    method: "PATCH",
    successMessage: "Line item status updated",
    errorMessage: "Failed to update line item status",
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="h-7 w-7" loading={isLoading}>
          <Icon icon="ph:bookmark-simple" className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {lineItemCompletionStatus.enumValues.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => trigger({ completionStatus: status })}
            className="cursor-pointer"
          >
            <LineItemStatusBadge status={status} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
