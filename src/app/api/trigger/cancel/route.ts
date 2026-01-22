import { NextResponse } from "next/server";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { runs } from "@trigger.dev/sdk/v3";

export async function POST(request: Request) {
  const user = await authorizeApiUser(["super_admin", "admin"]);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runId } = await request.json();

    if (!runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }


    const res = await runs.cancel(runId);
    console.log("res", res);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel run:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel run" },
      { status: 500 }
    );
  }
}
