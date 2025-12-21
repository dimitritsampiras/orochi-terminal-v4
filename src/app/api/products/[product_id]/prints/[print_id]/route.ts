import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { updatePrintSchema } from "@/lib/schemas/product-schema";
import { DeletePrintResponse, UpdatePrintResponse } from "@/lib/types/api";
import { prints } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ product_id: string; print_id: string }> }
): Promise<NextResponse<UpdatePrintResponse>> {
  try {
    const user = await authorizeUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { print_id } = await params;

    const rawBody = await req.json();
    const updateData = updatePrintSchema.parse(rawBody);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ data: null, error: "No fields to update" }, { status: 400 });
    }

    const [updatedPrint] = await db.update(prints).set(updateData).where(eq(prints.id, print_id)).returning();

    if (!updatedPrint) {
      return NextResponse.json({ data: null, error: "Print not found" }, { status: 404 });
    }

    await logger.info(`Print ${print_id} updated by ${user.username}`, {
      profileId: user.id,
    });

    return NextResponse.json({ data: updatedPrint, error: null });
  } catch (error) {
    console.error("Error updating print:", error);
    return NextResponse.json({ data: null, error: "Failed to update print" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ product_id: string; print_id: string }> }
): Promise<NextResponse<DeletePrintResponse>> {
  try {
    const user = await authorizeUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { print_id } = await params;

    await db.delete(prints).where(eq(prints.id, print_id));

    await logger.info(`Print ${print_id} deleted by ${user.username}`, {
      profileId: user.id,
    });

    return NextResponse.json({ data: "success", error: null });
  } catch (error) {
    console.error("Error deleting print:", error);
    return NextResponse.json({ data: null, error: "Failed to delete print" }, { status: 500 });
  }
}
