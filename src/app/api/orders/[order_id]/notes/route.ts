import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { buildResourceGid } from "@/lib/utils";
import { orderNotes } from "@drizzle/schema";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const addNoteSchema = z.object({
  note: z.string().min(1, "Note cannot be empty"),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ order_id: string }> }) {
  try {
    const user = await authorizeApiUser(["super_admin", "admin", "warehouse_staff"]);

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { order_id } = await params;
    const orderId = buildResourceGid("Order", order_id);

    const body = await request.json();
    const { note } = addNoteSchema.parse(body);

    await db.insert(orderNotes).values({
      orderId,
      profileId: user.id,
      note,
    });

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error adding note:", error);
    return NextResponse.json({ data: null, error: "Failed to add note" }, { status: 500 });
  }
}

