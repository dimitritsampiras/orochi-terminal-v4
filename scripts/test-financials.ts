
import "dotenv/config";
import { getFinancialMetrics } from "@/lib/core/analytics/financial-metrics";

async function run() {
    // Test Range: Last 30 Days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    console.log(`Running Financial Analytics Test`);
    console.log(`Range: ${start.toISOString()} - ${end.toISOString()}`);
    console.log("------------------------------------------------");

    try {
        const metrics = await getFinancialMetrics(start, end);

        console.log("REVENUE / REAL DATA:");
        console.log(`Revenue:      $${metrics.revenue.toFixed(2)}`);
        console.log(`Shipping:     $${metrics.shippingCost.toFixed(2)}`);
        console.log(`Orders:       ${metrics.metrics.orderCount}`);
        console.log(`Items:        ${metrics.metrics.itemCount}`);

        console.log("\nEXTRAPOLATED / PROJECTED COSTS:");
        console.log(`Labor:        $${metrics.laborCost.toFixed(2)} ${metrics.metrics.isLaborExtrapolated ? "(Extrapolated)" : "(Actual)"}`);
        console.log(`Rent:         $${metrics.recurringCosts.rent.toFixed(2)} ${metrics.metrics.isRentExtrapolated ? "(Extrapolated)" : "(Actual)"}`);
        console.log(`Marketing:    $${metrics.recurringCosts.marketing.toFixed(2)} ${metrics.metrics.isMarketingExtrapolated ? "(Extrapolated)" : "(Actual)"}`);
        console.log(`Supplies:     $${metrics.suppliesCost.toFixed(2)}`);

        console.log("\nPROFITABILITY:");
        console.log(`Total Exp:    $${metrics.totalExpenses.toFixed(2)}`);
        console.log(`Net Profit:   $${metrics.netProfit.toFixed(2)}`);

    } catch (e) {
        console.error("Failed to run analytics:", e);
    }
    process.exit(0);
}

run();
