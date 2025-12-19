"use client";

import { Input } from "@/components/ui/input";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { UpdateBlankVariantSchema } from "@/lib/schemas/product-schema";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const UpdateBlankQuantityForm = ({
  blankId,
  blankVariantId,
  currentQuantity,
  className,
}: {
  blankId: string;
  blankVariantId: string;
  currentQuantity: number;
  className?: string;
}) => {
  const [value, setValue] = useState(currentQuantity);
  const [isDirty, setIsDirty] = useState(false);
  const isSubmittingRef = useRef(false);

  const { isLoading, trigger } = useFetcher<UpdateBlankVariantSchema>({
    path: `/api/blanks/${blankId}/blank-variants/${blankVariantId}`,
    method: "PATCH",
    successMessage: "Quantity updated",
    onSuccess: () => {
      setIsDirty(false);
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
      isSubmittingRef.current = true;
      handleSubmit();
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

  const handleSubmit = async () => {
    const toastId = toast.loading("Updating quantity...");
    try {
      await trigger({ quantity: Number(value) });
      toast.dismiss(toastId);
    } catch (error) {
      toast.dismiss(toastId);
      isSubmittingRef.current = false;
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
      disabled={isLoading}
      min={0}
    />
  );
};
