"use server";

import { revalidatePath } from "next/cache";

export async function revalidateSessionPages(sessionId?: number) {
  // Invalidate the sessions list
  revalidatePath("/sessions");

  // Invalidate specific session page if provided
  if (sessionId) {
    revalidatePath(`/sessions/${sessionId}`);
  }

  // Invalidate orders pages that might show shipment status
  revalidatePath("/orders");
}

