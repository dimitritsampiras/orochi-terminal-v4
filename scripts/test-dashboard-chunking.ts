
import "dotenv/config";
import { getFinancialMetrics } from "@/lib/core/analytics/financial-metrics";
import { eachDayOfInterval, format, subDays } from "date-fns";

async function run() {
    console.log("Starting Dashboard Data Fetch Test...");
    const end = new Date();
    const start = subDays(end, 30); // 30 days range

    console.log(`Range: ${start.toISOString()} - ${end.toISOString()}`);

    const days = eachDayOfInterval({ start, end });
    const concurrencyLimit = 5;
    const chartData = [];

    console.log(`Total Days: ${days.length}. Processing in chunks of ${concurrencyLimit}...`);

    for (let i = 0; i < days.length; i += concurrencyLimit) {
        console.log(`Processing chunk starting at index ${i}...`);
        const chunk = days.slice(i, i + concurrencyLimit);

        try {
            const chunkResults = await Promise.all(
                chunk.map(async (day) => {
                    const metrics = await getFinancialMetrics(day, day);
                    return {
                        date: format(day, "MMM dd"),
                        revenue: metrics.revenue,
                    };
                })
            );
            chartData.push(...chunkResults);
            console.log(`Chunk ${i} done.`);
        } catch (e) {
            console.error(`Error in chunk ${i}:`, e);
        }
    }

    console.log("Finished!");
    console.log(`Generated ${chartData.length} data points.`);
    process.exit(0);
}

run();
