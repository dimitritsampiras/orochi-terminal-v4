import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { createBlankVariantSchema } from "@/lib/schemas/product-schema";
import { CreateBlankVariantResponse } from "@/lib/types/api";
import { blankVariants } from "@drizzle/schema";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ blank_id: string }> }
): Promise<NextResponse<CreateBlankVariantResponse>> {
  try {
    const user = await authorizeApiUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { blank_id } = await params;
    const rawBody = await req.json();
    const { color, size, weight, volume, quantity } = createBlankVariantSchema.parse(rawBody);

    // Check for existing variant with same color and size
    const existingVariant = await db.query.blankVariants.findFirst({
      where: {
        blankId: blank_id,
        color: color,
        size: size,
      },
    });

    if (existingVariant) {
      return NextResponse.json(
        { data: null, error: `Variant ${color} / ${size.toUpperCase()} already exists` },
        { status: 400 }
      );
    }

    const [newVariant] = await db
      .insert(blankVariants)
      .values({
        blankId: blank_id,
        color,
        size,
        weight,
        volume,
        quantity: quantity ?? 0,
      })
      .returning();

    await logger.info(
      `Blank Variant created: ${color} / ${size.toUpperCase()} for blank ${blank_id} by ${user.username}`,
      { profileId: user.id }
    );

    return NextResponse.json({ data: newVariant, error: null });
  } catch (error) {
    console.error("Error creating blank variant:", error);
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json(
        { data: null, error: "A variant with this color and size already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: null, error: "Failed to create blank variant" }, { status: 500 });
  }
}

