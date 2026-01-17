"use client";

import { Input } from "@/components/ui/input";
import { type UpdateVariantSchema } from "@/lib/schemas/product-schema";
import { cn, parseGid } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const UpdateOverstockForm = ({
  variantId,
  productId,
  currentWarehouseInventory,
  isBlackLabel = false,
  batchId,
  onSuccess,
}: {
  variantId: string;
  productId: string;
  isBlackLabel: boolean;
  currentWarehouseInventory: number;
  batchId?: number;
  onSuccess?: () => void;
}) => {
  const [value, setValue] = useState(currentWarehouseInventory);
  const [isDirty, setIsDirty] = useState(false);
  const isSubmittingRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async (newInventory: number) => {
      const res = await fetch(`/api/products/${parseGid(productId)}/variants/${parseGid(variantId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newInventory, batchId } satisfies UpdateVariantSchema),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to update inventory");
      }
      return data;
    },
    onSuccess: () => {
      setIsDirty(false);
      isSubmittingRef.current = false;
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
      isSubmittingRef.current = false;
    },
  });

  // Sync local state if prop changes from parent
  useEffect(() => {
    setValue(currentWarehouseInventory);
    setIsDirty(false);
  }, [currentWarehouseInventory]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let newValue = value;
    if (e.key === "ArrowUp") {
      newValue = value + 1;
      setValue(newValue);
      setIsDirty(newValue !== currentWarehouseInventory);
      e.preventDefault();
    }

    if (e.key === "ArrowDown") {
      newValue = Math.max(0, value - 1);
      setValue(newValue);
      setIsDirty(newValue !== currentWarehouseInventory);
      e.preventDefault();
    }

    if (e.key === "Enter") {
      if (isDirty) {
        isSubmittingRef.current = true;
        toast.promise(mutation.mutateAsync(value), {
          loading: "Updating inventory...",
          success: "Inventory updated",
          error: (err) => err.message,
        });
      }
      e.currentTarget.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value === "" ? 0 : Number(e.target.value);
    if (isNaN(inputValue) || inputValue < 0) return;
    setValue(inputValue);
    setIsDirty(inputValue !== currentWarehouseInventory);
  };

  const handleBlur = () => {
    // Only reset if we are dirty and NOT submitting
    if (isDirty && !isSubmittingRef.current) {
      setValue(currentWarehouseInventory);
      setIsDirty(false);
    }
  };

  return (
    <Input
      className={cn(
        "max-w-16 rounded-md border border-gray-300 p-2 text-right transition-colors",
        isDirty && "bg-orange-200!"
      )}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={mutation.isPending || isBlackLabel}
      readOnly={isBlackLabel}
    />
  );
};
