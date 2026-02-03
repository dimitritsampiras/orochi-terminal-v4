/**
 * Test script to validate weekly profitability calculations against Shopify Analytics benchmark
 *
 * Usage:
 *   tsx scripts/test-weekly-profitability.ts 2025-01-20 2025-01-26
 */

// Load environment variables BEFORE any other imports
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import { calculateWeeklyProfitability } from "@/lib/core/analytics/calculate-weekly-profitability";
import { fromZonedTime } from "date-fns-tz";

interface Benchmark {
    grossSales: number;
    discounts: number;
    returns: number;
    netSales: number;
    shippingCharges: number;
    returnFees: number;
    taxes: number;
    totalSales: number;
}

const BENCHMARK: Benchmark = {
    grossSales: 15294.42,
    discounts: 2200.54,
    returns: 994.44,
    netSales: 12099.44,
    shippingCharges: 403.86,
    returnFees: 0.00,
    taxes: 199.90,
    totalSales: 12703.20,
};

const TOLERANCE = 50; // $50 tolerance

function formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

function formatDifference(diff: number): string {
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${formatCurrency(diff)}`;
}

async function testWeeklyProfitability(weekStart: Date, weekEnd: Date) {
    console.log("=".repeat(80));
    console.log("Testing Weekly Profitability Calculations");
    console.log("=".repeat(80));
    console.log(`Week: ${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`);
    console.log("");

    // Calculate report
    console.log("Calculating profitability report...");
    const report = await calculateWeeklyProfitability(weekStart, weekEnd, {
        useHistoricalPayroll: true,
    });

    const { revenue } = report;

    console.log("");
    console.log("Raw Results:");
    console.log("  Gross Sales:", formatCurrency(revenue.grossSales));
    console.log("  Discounts:", formatCurrency(revenue.discounts));
    console.log("  Returns:", formatCurrency(revenue.returns));
    console.log("  Net Sales:", formatCurrency(revenue.netSales));
    console.log("  Shipping Charges:", formatCurrency(revenue.shippingCharges));
    console.log("  Return Fees:", formatCurrency(revenue.returnFees));
    console.log("  Taxes:", formatCurrency(revenue.taxes));
    console.log("  Total Sales:", formatCurrency(revenue.totalSales));
    console.log("");

    // Test results
    const results = [
        {
            name: "Gross sales",
            actual: revenue.grossSales,
            expected: BENCHMARK.grossSales,
        },
        {
            name: "Discounts",
            actual: revenue.discounts,
            expected: BENCHMARK.discounts,
        },
        {
            name: "Returns",
            actual: revenue.returns,
            expected: BENCHMARK.returns,
        },
        {
            name: "Net sales",
            actual: revenue.netSales,
            expected: BENCHMARK.netSales,
        },
        {
            name: "Shipping charges",
            actual: revenue.shippingCharges,
            expected: BENCHMARK.shippingCharges,
        },
        {
            name: "Return fees",
            actual: revenue.returnFees,
            expected: BENCHMARK.returnFees,
        },
        {
            name: "Taxes",
            actual: revenue.taxes,
            expected: BENCHMARK.taxes,
        },
        {
            name: "Total sales",
            actual: revenue.totalSales,
            expected: BENCHMARK.totalSales,
        },
    ];

    console.log("Comparison to Benchmark:");
    console.log("-".repeat(80));
    console.log(
        "Metric".padEnd(20) +
        "Expected".padEnd(15) +
        "Actual".padEnd(15) +
        "Difference".padEnd(15) +
        "Status"
    );
    console.log("-".repeat(80));

    let allPassed = true;

    for (const result of results) {
        const diff = result.actual - result.expected;
        const withinTolerance = Math.abs(diff) <= TOLERANCE;
        const status = withinTolerance ? "✓ PASS" : "✗ FAIL";

        if (!withinTolerance) {
            allPassed = false;
        }

        console.log(
            result.name.padEnd(20) +
            formatCurrency(result.expected).padEnd(15) +
            formatCurrency(result.actual).padEnd(15) +
            formatDifference(diff).padEnd(15) +
            status
        );
    }

    console.log("-".repeat(80));
    console.log("");

    if (allPassed) {
        console.log("✓ All tests passed! All values are within $50 tolerance.");
    } else {
        console.log("✗ Some tests failed. Values are outside $50 tolerance.");
    }

    console.log("");
    console.log("=".repeat(80));

    return allPassed;
}

// Main execution
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error("Usage: tsx scripts/test-weekly-profitability.ts <start-date> <end-date>");
    console.error("Example: tsx scripts/test-weekly-profitability.ts 2025-01-20 2025-01-26");
    process.exit(1);
}

// Parse dates as Eastern Time and convert to UTC
// Input: "2026-01-26" means "January 26, 2026 at 00:00:00 Eastern Time"
const EASTERN_TIMEZONE = "America/New_York";
const weekStart = fromZonedTime(args[0] + " 00:00:00", EASTERN_TIMEZONE);
const weekEnd = fromZonedTime(args[1] + " 23:59:59.999", EASTERN_TIMEZONE);

testWeeklyProfitability(weekStart, weekEnd)
    .then((passed) => {
        process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
        console.error("Error running test:", error);
        console.error(error.stack);
        process.exit(1);
    });
