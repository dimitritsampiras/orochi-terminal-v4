
import { NextRequest, NextResponse } from "next/server";
import {
    getQueuedAnalyticsSummary,
    calculateShippingCostsGenerator,
} from "@/lib/core/analytics/calculate-queued-analytics";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    // Parse cutoff date from query params
    const cutoffParam = req.nextUrl.searchParams.get("cutoff");
    const cutoffDate = cutoffParam ? new Date(cutoffParam) : undefined;

    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;

            const safeEnqueue = (data: string) => {
                if (!isClosed) {
                    try {
                        controller.enqueue(encoder.encode(data));
                    } catch (e) {
                        // Controller may have been closed by client disconnect
                        isClosed = true;
                    }
                }
            };

            const safeClose = () => {
                if (!isClosed) {
                    isClosed = true;
                    try {
                        controller.close();
                    } catch (e) {
                        // Already closed
                    }
                }
            };

            try {
                // 1. Send Initial Summary (Fast)
                const summary = await getQueuedAnalyticsSummary(cutoffDate);
                const initialPayload = { type: "SUMMARY", data: summary };
                safeEnqueue(`data: ${JSON.stringify(initialPayload)}\n\n`);

                // 2. Stream Shipping Progress (Slow)
                for await (const progress of calculateShippingCostsGenerator(cutoffDate)) {
                    const payload = { type: "SHIPPING_PROGRESS", data: progress };
                    safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
                }

                // 3. Send completion signal
                safeEnqueue(`data: ${JSON.stringify({ type: "COMPLETE" })}\n\n`);

                // 4. Close Stream
                safeClose();
            } catch (error) {
                console.error("Streaming error:", error);
                safeClose();
            }
        },
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    });
}
