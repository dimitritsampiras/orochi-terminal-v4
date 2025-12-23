import { db } from "@/lib/clients/db";
import { getAssemblyLine } from "@/lib/core/session/create-assembly-line";
import { GetAssemblyLineResponse } from "@/lib/types/api";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse<GetAssemblyLineResponse>> {
  // get live session
  const activeSession = await db.query.batches.findMany({
    where: { active: true },
  });

  if (activeSession.length === 0 || activeSession.length > 1) {
    return NextResponse.json({ data: null, error: "No active session found" }, { status: 404 });
  }

  const { data, error } = await getAssemblyLine(activeSession[0].id);

  if (error || !data) {
    return NextResponse.json({ error: error || "An unknown error occurred", data: null }, { status: 500 });
  }

  return NextResponse.json({ data: { lineItems: data.lineItems, batchId: activeSession[0].id }, error: null });
}
