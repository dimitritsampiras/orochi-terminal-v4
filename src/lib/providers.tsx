"use client";

import { AppProgressProvider } from "@bprogress/next";
import type { ReactNode } from "react";
import { LocalServerProvider } from "./hooks/use-local-server";
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProgressProvider color="#000" options={{ showSpinner: false }}>
        <LocalServerProvider>{children}</LocalServerProvider>
      </AppProgressProvider>
    </QueryClientProvider>
  );
}
