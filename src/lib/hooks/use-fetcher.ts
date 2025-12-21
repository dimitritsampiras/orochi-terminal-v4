"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ZodSchema } from "zod";

interface UseFetcherOptions<T, K = unknown> {
  path: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: K) => void;
  showToast?: boolean;
}

interface TriggerOptions {
  successMessage?: string;
  errorMessage?: string;
}

export function useFetcher<T, K = unknown>({
  path,
  method,
  successMessage = "Operation successful",
  errorMessage = "Operation failed",
  showToast = true,
  onSuccess,
}: UseFetcherOptions<T, K>) {
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
        console.log("API Error:", error);
        toast.error(error.message || finalErrorMessage);
        return;
      }

      const data = (await response.json()) as K;

      if (showToast) {
        toast.success(finalSuccessMessage);
      }

      onSuccess?.(data);

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
