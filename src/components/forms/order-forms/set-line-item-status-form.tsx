import { LineItemStatusBadge } from "@/components/badges/line-item-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditLineItemSchema } from "@/lib/schemas/order-schema";
import { cn, parseGid, sleep } from "@/lib/utils";
import { lineItemCompletionStatus } from "@drizzle/schema";
import { Icon } from "@iconify/react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export const SetLineItemStatusForm = ({ lineItemId, orderId, className }: { lineItemId: string, orderId: string, className?: string }) => {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async (input: EditLineItemSchema) => {
      const res = await fetch(`/api/orders/${parseGid(orderId)}/line-items/${parseGid(lineItemId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        throw new Error("Failed to update line item status");
      }

      return res.json();
    },
    onSuccess: async () => {
      router.refresh();
      await sleep(1000);
      toast.success("Line item status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className={cn("h-7 w-7", className)} loading={mutation.isPending}>
          <Icon icon="ph:bookmark-simple" className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {lineItemCompletionStatus.enumValues.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => mutation.mutate({ completionStatus: status })}
            className="cursor-pointer"
          >
            <LineItemStatusBadge status={status} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
