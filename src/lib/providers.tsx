"use client";

import { AppProgressProvider } from "@bprogress/next";
import type { ReactNode } from "react";
import { LocalServerProvider } from "./hooks/use-local-server";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProgressProvider color="#000" options={{ showSpinner: false }}>
      <LocalServerProvider>{children}</LocalServerProvider>
    </AppProgressProvider>
  );
}
