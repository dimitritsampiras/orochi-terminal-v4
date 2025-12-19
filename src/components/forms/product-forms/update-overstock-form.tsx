"use client";

import { Input } from "@/components/ui/input";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { UpdateVariantSchema } from "@/lib/schemas/product-schema";
import { cn, parseGid } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const UpdateOverstockForm = ({
  variantId,
  productId,
  currentWarehouseInventory,
  isBlackLabel = false,
}: {
  variantId: string;
  productId: string;
  isBlackLabel: boolean;
  currentWarehouseInventory: number;
}) => {
  const [value, setValue] = useState(currentWarehouseInventory);
  const [isDirty, setIsDirty] = useState(false);
  const isSubmittingRef = useRef(false);

  const { isLoading, trigger } = useFetcher<UpdateVariantSchema>({
    path: `/api/products/${parseGid(productId)}/variants/${parseGid(variantId)}`,
    method: "PATCH",
    successMessage: "Variant updated successfully",
    onSuccess: () => {
      setIsDirty(false);
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
      newValue = value - 1;
      setValue(newValue);
      setIsDirty(newValue !== currentWarehouseInventory);
      e.preventDefault();
    }

    if (e.key === "Enter") {
      isSubmittingRef.current = true;
      handleSubmit();
      e.currentTarget.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value === "" ? 0 : Number(e.target.value);
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

  const handleSubmit = async () => {
    const toastId = toast.loading("Updating inventory...");
    try {
      await trigger({ warehouseInventory: Number(value) });
      toast.dismiss(toastId);
    } catch (error) {
      toast.dismiss(toastId);
      isSubmittingRef.current = false;
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
      disabled={isLoading || isBlackLabel}
      readOnly={isBlackLabel}
    />
  );
};
