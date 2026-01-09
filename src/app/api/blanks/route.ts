import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { createBlankSchema } from "@/lib/schemas/product-schema";
import { CreateBlankResponse, GetBlanksResponse } from "@/lib/types/api";
import { blanks, blankVariants } from "@drizzle/schema";
import { type NextRequest, NextResponse } from "next/server";

export const GET = async (): Promise<NextResponse<GetBlanksResponse>> => {
  const user = await authorizeApiUser(["super_admin", "admin", "warehouse_staff"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const allBlanks = await db.query.blanks.findMany({
    with: {
      blankVariants: true,
    },
  });

  return NextResponse.json({ data: allBlanks, error: null });
};

export const POST = async (req: NextRequest): Promise<NextResponse<CreateBlankResponse>> => {
  try {
    const user = await authorizeUser(["superadmin", "admin"]);

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json();
    const parsed = createBlankSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { blankName, blankCompany, garmentType, customsPrice, firstColor, sizes } = parsed.data;

    // Create the blank
    const [newBlank] = await db
      .insert(blanks)
      .values({
        blankName,
        blankCompany,
        garmentType,
        customsPrice,
        links: [],
      })
      .returning();

    if (!newBlank) {
      return NextResponse.json({ data: null, error: "Failed to create blank" }, { status: 500 });
    }

    // Create blank variants for each size with the first color
    // Default weight and volume values (can be updated later)
    const defaultWeight = 8; // oz
    const defaultVolume = 100; // cubic inches

    const variantsToInsert = sizes.map((size) => ({
      blankId: newBlank.id,
      color: firstColor.toLowerCase(),
      size,
      weight: defaultWeight,
      volume: defaultVolume,
      quantity: 0,
    }));

    await db.insert(blankVariants).values(variantsToInsert);

    await logger.info(`Blank "${blankName}" created by ${user.username}`, {
      profileId: user.id,
    });

    return NextResponse.json({ data: newBlank, error: null });
  } catch (error) {
    console.error("Error creating blank:", error);
    return NextResponse.json({ data: null, error: "Failed to create blank" }, { status: 500 });
  }
};
