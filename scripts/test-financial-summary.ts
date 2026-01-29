
import "dotenv/config";
import { getFinancialMetrics } from "@/lib/core/analytics/financial-metrics";
import { subDays } from "date-fns";

async function run() {
    const end = new Date();
    const start = subDays(end, 30);
    console.log(`Running getFinancialMetrics for ${start.toISOString()} to ${end.toISOString()}...`);

    try {
        const metrics = await getFinancialMetrics(start, end);
        console.log("--- Financial Metrics Summary ---");
        console.log("Total Shipping:", metrics.shippingCost);
        console.log("Shipping Breakdown:", JSON.stringify(metrics.shippingBreakdown, null, 2));
        console.log("Blanks Cost:", metrics.blanksCost);
        console.log("Ink Cost:", metrics.inkCost);
        console.log("Forecasted Work Days:", metrics.forecastedWorkDays);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

run();
