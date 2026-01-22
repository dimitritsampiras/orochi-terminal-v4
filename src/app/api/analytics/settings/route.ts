import { db } from "@/lib/clients/db";
import { globalSettings } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
    inkCostPerPrint: z.number().min(0),
    bagCostPerOrder: z.number().min(0),
    labelCostPerOrder: z.number().min(0),
    misprintCostMultiplier: z.number().min(0).default(1.0),
    supplementaryItemCost: z.number().min(0).default(0),
    inkCostPerDesign: z.number().min(0).default(2.5),
});

export async function GET(request: NextRequest) {
    try {
        const settings = await db.query.globalSettings.findFirst();
        return NextResponse.json(settings ?? {
            inkCostPerPrint: 0,
            bagCostPerOrder: 0,
            labelCostPerOrder: 0,
            misprintCostMultiplier: 1.0,
            supplementaryItemCost: 0,
            inkCostPerDesign: 2.5,
        });
    } catch (e) {
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const json = await request.json();
        const body = settingsSchema.parse(json);

        // Singleton pattern: update existing or insert new
        // We assume ID 1 or just check if any exists
        const existing = await db.query.globalSettings.findFirst();

        if (existing) {
            const [updated] = await db.update(globalSettings)
                .set({ ...body, updatedAt: new Date() })
                .where(eq(globalSettings.id, existing.id))
                .returning();
            return NextResponse.json(updated);
        } else {
            const [inserted] = await db.insert(globalSettings)
                .values({ ...body })
                .returning();
            return NextResponse.json(inserted);
        }
    } catch (e) {
        console.error(e)
        if (e instanceof z.ZodError) {
            return NextResponse.json({ error: (e as any).errors }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
