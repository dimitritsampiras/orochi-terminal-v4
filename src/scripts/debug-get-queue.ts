
import "dotenv/config";
import { getOrderQueue } from "../lib/core/orders/get-order-queue";
import { db } from "../lib/clients/db";

async function debugQueue() {
    console.log("🔍 Debugging getOrderQueue...");
    try {
        const queue = await getOrderQueue({ withItemData: true, withBatchData: true });
        console.log(`\n📦 Total Orders returned by getOrderQueue: ${queue.length}`);

        // Counters
        let unfulfilledCount = 0;
        let usCount = 0;
        let usUnfulfilledCount = 0;
        let batchedCount = 0;
        let onHoldCount = 0;

        // Detailed analysis
        queue.forEach((o) => {
            const status = o.displayFulfillmentStatus || "NULL";
            const country = o.displayDestinationCountryCode || "NULL";
            const isUnfulfilled = status !== "FULFILLED";
            const isUS = country === "US";
            const isHold = status === "ON_HOLD"; // Check if this status exists in ENUM

            // Also check batches
            const hasBatches = "batches" in o && o.batches && o.batches.length > 0;

            if (isUnfulfilled) unfulfilledCount++;
            if (isUS) usCount++;
            if (isUnfulfilled && isUS) usUnfulfilledCount++;

            if (hasBatches) batchedCount++;
            if (isHold) onHoldCount++;
        });

        console.log("\n--- Analysis ---");
        console.log(`Total: ${queue.length}`);
        console.log(`Unfulfilled: ${unfulfilledCount}`);
        console.log(`US Orders: ${usCount}`);
        console.log(`US + Unfulfilled: ${usUnfulfilledCount}`);
        console.log(`Has Batches: ${batchedCount}`);
        console.log(`Status = ON_HOLD: ${onHoldCount}`);

        // Hypothesis check:
        console.log(`\nHypothesis (US + Unfulfilled - Batched): ${usUnfulfilledCount - batchedCount}`);

    } catch (e) {
        console.error("Error:", e);
    }
}

debugQueue();
