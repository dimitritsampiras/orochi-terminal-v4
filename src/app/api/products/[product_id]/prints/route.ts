import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { createPrintSchema } from "@/lib/schemas/product-schema";
import { CreatePrintResponse } from "@/lib/types/api";
import { buildResourceGid } from "@/lib/utils";
import { prints } from "@drizzle/schema";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ product_id: string }> }
): Promise<NextResponse<CreatePrintResponse>> {
  try {
    const user = await authorizeUser();

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { product_id } = await params;
    const productGid = buildResourceGid("Product", product_id);

    const rawBody = await req.json();
    const { location, heatTransferCode, isSmallPrint } = createPrintSchema.parse(rawBody);

    // Check if product already has 4 prints (max)
    const existingPrints = await db.query.prints.findMany({
      where: { productId: productGid },
    });

    if (existingPrints.length >= 4) {
      return NextResponse.json(
        { data: null, error: "Maximum of 4 prints per product reached" },
        { status: 400 }
      );
    }

    const [newPrint] = await db
      .insert(prints)
      .values({
        productId: productGid,
        location,
        heatTransferCode: heatTransferCode || null,
        isSmallPrint: isSmallPrint || false,
      })
      .returning();

    await logger.info(`Print created for product ${product_id}: ${location} by ${user.username}`, {
      profileId: user.id,
    });

    return NextResponse.json({ data: newPrint, error: null });
  } catch (error) {
    console.error("Error creating print:", error);
    return NextResponse.json({ data: null, error: "Failed to create print" }, { status: 500 });
  }
}

