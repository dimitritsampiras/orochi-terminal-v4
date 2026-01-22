import { calculateBatchProfitability } from "@/lib/core/analytics/calculate-batch-profitability";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ batch_id: string }> }
) {
    const { batch_id } = await params;
    const batchId = parseInt(batch_id, 10);

    if (isNaN(batchId)) {
        return NextResponse.json({ error: "Invalid batch ID" }, { status: 400 });
    }

    try {
        const data = await calculateBatchProfitability(batchId);

        if (!data) {
            return NextResponse.json({ error: "Batch not found" }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (e) {
        console.error("Error calculating batch profitability:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
