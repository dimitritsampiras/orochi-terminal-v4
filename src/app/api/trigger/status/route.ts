import { NextResponse } from "next/server";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { runs } from "@trigger.dev/sdk/v3";

export async function GET(request: Request) {
  const user = await authorizeApiUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 });
  }

  try {
    const run = await runs.retrieve(runId);

    return NextResponse.json({
      id: run.id,
      status: run.status,
      metadata: run.metadata,
      output: run.output,
    });
  } catch (error) {
    console.error("Failed to retrieve run:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retrieve run" },
      { status: 500 }
    );
  }
}
