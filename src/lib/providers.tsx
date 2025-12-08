'use client';

import { AppProgressProvider } from '@bprogress/next';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProgressProvider color="#000" options={{ showSpinner: false }}>
      {children}
    </AppProgressProvider>
  );
}
