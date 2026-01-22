import { NextResponse } from "next/server";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { tasks } from "@trigger.dev/sdk/v3";
import { bulkPurchaseShipmentsTask, type BulkPurchasePayload } from "@/trigger/bulk-purchase-shipments-v4";

export async function POST(request: Request) {
  const user = await authorizeApiUser(["super_admin", "admin"]);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload: BulkPurchasePayload = await request.json();

    // Trigger the task
    const handle = await tasks.trigger<typeof bulkPurchaseShipmentsTask>(
      "bulk-purchase-shipments-v4",
      payload
    );

    return NextResponse.json({ runId: handle.id });
  } catch (error) {
    console.error("Failed to trigger bulk shipments task:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to trigger task" },
      { status: 500 }
    );
  }
}
