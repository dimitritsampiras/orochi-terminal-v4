import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { scanSchema } from "@/lib/schemas/order-schema";
import { ScanResponse } from "@/lib/types/api";
import { shipments } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest): Promise<NextResponse<ScanResponse>> => {
  try {
    const user = await authorizeUser(["superadmin", "admin", "warehouse", "va", "staff"]);

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

  // 2. USPS GS1-128 handling: if it contains "420" + zip code prefix, extract tracking
  // Pattern: 420 + 5-9 digit zip + tracking number (starts with 9)
  const uspsMatch = clean.match(/(9[1-5]\d{18,21})/);
  if (uspsMatch) {
    return uspsMatch[1];
  }

  // 3. Everything else (UPS, FedEx, etc.) - return as-is
  return clean;
}
