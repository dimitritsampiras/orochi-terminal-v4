
import "dotenv/config";
import { getDailyFinancialMetrics } from "@/lib/core/analytics/financial-metrics";
import { subDays } from "date-fns";

async function run() {
    console.log("Starting Batched Metrics Test...");
    const end = new Date();
    const start = subDays(end, 30); // 30 days range

    console.log(`Range: ${start.toISOString()} - ${end.toISOString()}`);

    const startTime = performance.now();
    try {
        const results = await getDailyFinancialMetrics(start, end);
        const endTime = performance.now();
        console.log(`Success! Fetched ${results.length} days in ${(endTime - startTime).toFixed(2)}ms`);
        console.log("Sample Data (First Day):", results[0]);
    } catch (e) {
        console.error("Failed:", e);
    }
    process.exit(0);
}

run();
