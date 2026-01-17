"use client";

import { Input } from "@/components/ui/input";
import { type UpdateBlankVariantSchema } from "@/lib/schemas/product-schema";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const UpdateBlankQuantityForm = ({
  blankId,
  blankVariantId,
  currentQuantity,
  className,
  batchId,
  onSuccess,
}: {
  blankId: string;
  blankVariantId: string;
  currentQuantity: number;
  className?: string;
  batchId?: number;
  onSuccess?: () => void;
}) => {
  const [value, setValue] = useState(currentQuantity);
  const [isDirty, setIsDirty] = useState(false);
  const isSubmittingRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async (newQuantity: number) => {
      const res = await fetch(`/api/blanks/${blankId}/blank-variants/${blankVariantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newQuantity, batchId } satisfies UpdateBlankVariantSchema),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to update quantity");
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
    setValue(currentQuantity);
    setIsDirty(false);
  }, [currentQuantity]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let newValue = value;
    if (e.key === "ArrowUp") {
      newValue = value + 1;
      setValue(newValue);
      setIsDirty(newValue !== currentQuantity);
      e.preventDefault();
    }

    if (e.key === "ArrowDown") {
      newValue = Math.max(0, value - 1);
      setValue(newValue);
      setIsDirty(newValue !== currentQuantity);
      e.preventDefault();
    }

    if (e.key === "Enter") {
      if (isDirty) {
        isSubmittingRef.current = true;
        toast.promise(mutation.mutateAsync(value), {
          loading: "Updating quantity...",
          success: "Quantity updated",
          error: (err) => err.message,
        });
      }
      e.currentTarget.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value === "" ? 0 : Number(e.target.value);
    if (inputValue < 0) return;
    setValue(inputValue);
    setIsDirty(inputValue !== currentQuantity);
  };

  const handleBlur = () => {
    // Only reset if we are dirty and NOT submitting
    if (isDirty && !isSubmittingRef.current) {
      setValue(currentQuantity);
      setIsDirty(false);
    }
  };

  return (
    <Input
      className={cn(
        "w-16 rounded-md border border-gray-300 p-2 text-right transition-colors",
        isDirty && "bg-orange-200!",
        className
      )}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={mutation.isPending}
      min={0}
    />
  );
};
