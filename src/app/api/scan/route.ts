import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { scanSchema } from "@/lib/schemas/order-schema";
import { ScanResponse } from "@/lib/types/api";
import { shipments } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest): Promise<NextResponse<ScanResponse>> => {
  try {
    const user = await authorizeApiUser(["super_admin", "admin", "warehouse_staff"]);

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json();

    const { data: body } = await scanSchema.safeParseAsync(rawBody);

    if (!body) {
      return NextResponse.json({ data: null, error: "Invalid request" }, { status: 400 });
    }

    const trackingNumber = extractTrackingNumber(body.decodedText);

    const shipment = await db.query.shipments.findFirst({
      where: {
        trackingNumber,
      },
    });

    if (!shipment) {
      return NextResponse.json(
        {
          data: null,
          error: "Shipment not found. Try a different bar/QR code.",
        },
        { status: 404 }
      );
    }

    if (shipment.gateScannedAt) {
      return NextResponse.json({ data: null, error: "Shipment already scanned" }, { status: 400 });
    }

    await db
      .update(shipments)
      .set({
        gateScannedAt: new Date(),
        gateScannerBy: user.id,
      })
      .where(eq(shipments.id, shipment.id));

    logger.info(`[scan shipment] Shipment w tracking ${shipment.trackingNumber} scanned by ${user.username}`, {
      profileId: user.id,
    });

    return NextResponse.json({ data: "Successfully scanned shipment", error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
};

function extractTrackingNumber(raw: string): string {
  // 1. Remove GS1 Group Separator characters
  const clean = raw.replace(/\x1D/g, "");

  // 2. USPS GS1-128 handling: 420 + ZIP + tracking
  if (clean.startsWith("420")) {
    // Try 9-digit ZIP first (420 + 9 digits + tracking starting with 9)
    const match9 = clean.match(/^420\d{9}(9\d{15,21})$/);
    if (match9) return match9[1];

    // Try 5-digit ZIP (420 + 5 digits + tracking starting with 9)
    const match5 = clean.match(/^420\d{5}(9\d{15,21})$/);
    if (match5) return match5[1];
  }

  // 3. Fallback: look for USPS tracking pattern anywhere
  const uspsMatch = clean.match(/(9[1-5]\d{18,21})/);
  if (uspsMatch) return uspsMatch[1];

  // 4. Everything else - return as-is
  return clean;
}