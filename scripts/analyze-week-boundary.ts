/**
 * Debug script to analyze order date boundaries
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const EASTERN_TIMEZONE = "America/New_York";

async function analyzeOrders() {
    // Parse dates as Eastern Time
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    console.log("Analyzing orders for week:");
    console.log(`Start (ET): 2026-01-26 00:00:00`);
    console.log(`Start (UTC): ${startISO}`);
    console.log(`End (ET): 2026-02-01 23:59:59.999`);
    console.log(`End (UTC): ${endISO}`);
    console.log("");

    const query = `#graphql
        query GetOrders($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
                        createdAt
                        totalPriceSet {
                            shopMoney {
                                amount
                            }
                        }
                    }
                }
            }
        }
    `;

    const searchQuery = `created_at:>='${startISO}' created_at:<='${endISO}'`;

    const { data, errors } = await shopify.request(query, {
        variables: { query: searchQuery },
    });

    if (errors) {
        console.error("Errors:", errors);
        return;
    }

    const orders = data?.orders?.edges || [];
    console.log(`Found ${orders.length} orders`);
    console.log("");

    // Show first and last few orders
    console.log("First 3 orders:");
    orders.slice(0, 3).forEach((edge: any) => {
        const createdAtET = formatInTimeZone(
            new Date(edge.node.createdAt),
            EASTERN_TIMEZONE,
            "yyyy-MM-dd HH:mm:ss zzz"
        );
        console.log(`  ${edge.node.name}: ${createdAtET} - $${edge.node.totalPriceSet.shopMoney.amount}`);
    });

    console.log("");
    console.log("Last 3 orders:");
    orders.slice(-3).forEach((edge: any) => {
        const createdAtET = formatInTimeZone(
            new Date(edge.node.createdAt),
            EASTERN_TIMEZONE,
            "yyyy-MM-dd HH:mm:ss zzz"
        );
        console.log(`  ${edge.node.name}: ${createdAtET} - $${edge.node.totalPriceSet.shopMoney.amount}`);
    });

    // Calculate total
    const total = orders.reduce((sum: number, edge: any) => {
        return sum + parseFloat(edge.node.totalPriceSet.shopMoney.amount);
    }, 0);

    console.log("");
    console.log(`Total order value: $${total.toFixed(2)}`);
}

analyzeOrders()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
