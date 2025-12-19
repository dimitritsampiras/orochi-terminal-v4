"use client";

import { Input } from "@/components/ui/input";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { UpdateBlankVariantSchema } from "@/lib/schemas/product-schema";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type FieldType = "quantity" | "weight" | "volume";

const FIELD_CONFIG: Record<FieldType, { label: string; allowDecimals: boolean }> = {
  quantity: { label: "Quantity", allowDecimals: false },
  weight: { label: "Weight", allowDecimals: true },
  volume: { label: "Volume", allowDecimals: true },
};

export const UpdateBlankVariantInput = ({
  blankId,
  blankVariantId,
  field,
  currentValue,
  className,
}: {
  blankId: string;
  blankVariantId: string;
  field: FieldType;
  currentValue: number;
  className?: string;
}) => {
  const [inputValue, setInputValue] = useState(String(currentValue));
  const [isDirty, setIsDirty] = useState(false);
  const isSubmittingRef = useRef(false);
  const config = FIELD_CONFIG[field];

  const { isLoading, trigger } = useFetcher<UpdateBlankVariantSchema>({
    path: `/api/blanks/${blankId}/blank-variants/${blankVariantId}`,
    method: "PATCH",
    successMessage: `${config.label} updated`,
    onSuccess: () => {
      setIsDirty(false);
      isSubmittingRef.current = false;
    },
  });

  useEffect(() => {
    setInputValue(String(currentValue));
    setIsDirty(false);
  }, [currentValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentNumValue = parseFloat(inputValue) || 0;

    if (e.key === "ArrowUp") {
      const newValue = currentNumValue + 1;
      setInputValue(String(newValue));
      setIsDirty(newValue !== currentValue);
      e.preventDefault();
    }

    if (e.key === "ArrowDown") {
      const newValue = Math.max(0, currentNumValue - 1);
      setInputValue(String(newValue));
      setIsDirty(newValue !== currentValue);
      e.preventDefault();
    }

    if (e.key === "Enter") {
      isSubmittingRef.current = true;
      handleSubmit();
      e.currentTarget.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow empty string
    if (raw === "") {
      setInputValue("");
      setIsDirty(true);
      return;
    }

    // Validate input based on field type
    if (config.allowDecimals) {
      // Allow digits and one decimal point
      if (!/^-?\d*\.?\d*$/.test(raw)) return;
    } else {
      // Only allow digits
      if (!/^\d*$/.test(raw)) return;
    }

    const numValue = parseFloat(raw);
    if (!isNaN(numValue) && numValue < 0) return;

    setInputValue(raw);
    setIsDirty(!isNaN(numValue) ? numValue !== currentValue : true);
  };

  const handleBlur = () => {
    if (isDirty && !isSubmittingRef.current) {
      setInputValue(String(currentValue));
      setIsDirty(false);
    }
  };

  const handleSubmit = async () => {
    const numValue = parseFloat(inputValue) || 0;
    const toastId = toast.loading(`Updating ${config.label.toLowerCase()}...`);
    try {
      await trigger({ [field]: numValue });
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
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={isLoading}
    />
  );
};
