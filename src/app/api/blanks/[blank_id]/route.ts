import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { updateBlankSchema } from "@/lib/schemas/product-schema";
import { UpdateBlankResponse } from "@/lib/types/api";
import { blanks } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ blank_id: string }> }
): Promise<NextResponse<UpdateBlankResponse>> {
  try {
    const user = await authorizeUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { blank_id } = await params;
    const rawBody = await req.json();
    const updateData = updateBlankSchema.parse(rawBody);

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ data: null, error: "No fields to update" }, { status: 400 });
    }

    const [updatedBlank] = await db
      .update(blanks)
      .set(updateData)
      .where(eq(blanks.id, blank_id))
      .returning();

    if (!updatedBlank) {
      return NextResponse.json({ data: null, error: "Blank not found" }, { status: 404 });
    }

    await logger.info(`Blank ${blank_id} updated by ${user.username}`, {
      profileId: user.id,
    });

    return NextResponse.json({ data: updatedBlank, error: null });
  } catch (error) {
    console.error("Error updating blank:", error);
    return NextResponse.json({ data: null, error: "Failed to update blank" }, { status: 500 });
  }
}

