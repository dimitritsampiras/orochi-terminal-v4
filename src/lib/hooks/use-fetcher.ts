"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ZodSchema } from "zod";

interface UseFetcherOptions<T> {
  path: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  showToast?: boolean
}

interface TriggerOptions {
  successMessage?: string;
  errorMessage?: string;
}

export function useFetcher<T>({
  path,
  method,
  successMessage = "Operation successful",
  errorMessage = "Operation failed",
  showToast = true,
  onSuccess,
}: UseFetcherOptions<T>) {
  const router = useRouter();
  // Manage fetch loading state
  const [isFetching, setIsFetching] = useState(false);
  // Manage router refresh loading state
  const [isPending, startTransition] = useTransition();

  const trigger = async (body?: T, options?: TriggerOptions) => {
    setIsFetching(true);

    const finalSuccessMessage = options?.successMessage ?? successMessage;
    const finalErrorMessage = options?.errorMessage ?? errorMessage;

    try {
      const response = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("API Error:", error);
        throw new Error(error.message || finalErrorMessage);
      }

      if (showToast) {
        toast.success(finalSuccessMessage);
      }

      onSuccess?.();

      // Refresh the route and mark transaction as finished
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      if (showToast) {
        toast.error(error instanceof Error ? error.message : finalErrorMessage);
      }
    } finally {
      setIsFetching(false);
    }
  };

  return {
    trigger,
    isLoading: isFetching || isPending,
  };
}
