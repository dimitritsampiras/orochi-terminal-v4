/**
 * Compare GraphQL query results with Shopify's Gross Sales CSV
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime } from "date-fns-tz";
import * as fs from "fs";
import * as path from "path";

const EASTERN_TIMEZONE = "America/New_York";

async function compareWithCSV() {
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    // Fetch orders like the debug script does
    const ordersQuery = `#graphql
        query GetOrders($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
                        lineItems(first: 250) {
                            nodes {
                                id
                                title
                                variantTitle
                                quantity
                                originalUnitPriceSet {
                                    shopMoney {
                                        amount
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    const { data } = await shopify.request(ordersQuery, {
        variables: { query: `created_at:>='${startISO}' created_at:<='${endISO}'` },
    });

    const orders = data?.orders?.edges || [];

    // Calculate from GraphQL
    let graphqlTotal = 0;
    const graphqlItems: Array<{ orderName: string; title: string; qty: number; price: number; total: number }> = [];

    for (const edge of orders) {
        const order = edge.node;
        if (order.lineItems?.nodes) {
            for (const lineItem of order.lineItems.nodes) {
                const originalUnitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
                const quantity = lineItem.quantity || 0;
                const itemTotal = originalUnitPrice * quantity;
                graphqlTotal += itemTotal;

                if (itemTotal > 0) {
                    graphqlItems.push({
                        orderName: order.name,
                        title: `${lineItem.title || ''}${lineItem.variantTitle ? ' - ' + lineItem.variantTitle : ''}`,
                        qty: quantity,
                        price: originalUnitPrice,
                        total: itemTotal
                    });
                }
            }
        }
    }

    // Read CSV
    const csvPath = path.join(__dirname, "../src/lib/core/analytics/reference_reports/Gross sales by order.csv");
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    let csvTotal = 0;
    const csvItems: Array<{ orderName: string; title: string; amount: number }> = [];

    // Simple CSV parsing (handles quoted fields)
    const lines = csvContent.split('\n');
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Split by comma, handling quoted fields
        const fields: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        fields.push(currentField);

        if (fields.length >= 5) {
            const orderName = fields[2];
            const productTitle = fields[3];
            const grossSales = parseFloat(fields[4] || "0");

            if (grossSales > 0 && productTitle && productTitle !== 'Tip') {
                csvTotal += grossSales;
                csvItems.push({
                    orderName,
                    title: productTitle,
                    amount: grossSales
                });
            }
        }
    }

    console.log("=".repeat(80));
    console.log("Comparison: GraphQL vs Shopify CSV");
    console.log("=".repeat(80));
    console.log(`GraphQL Total: $${graphqlTotal.toFixed(2)}`);
    console.log(`GraphQL Line Items: ${graphqlItems.length}`);
    console.log("");
    console.log(`CSV Total (non-zero, excluding tips): $${csvTotal.toFixed(2)}`);
    console.log(`CSV Line Items (non-zero, excluding tips): ${csvItems.length}`);
    console.log("");
    console.log(`Difference: $${(csvTotal - graphqlTotal).toFixed(2)}`);
    console.log(`Line item count difference: ${csvItems.length - graphqlItems.length}`);
    console.log("=".repeat(80));

    // Find items in CSV not in GraphQL
    const graphqlSet = new Set(graphqlItems.map(item => `${item.orderName}|${item.title}|${item.total.toFixed(2)}`));
    const csvSet = new Set(csvItems.map(item => `${item.orderName}|${item.title}|${item.amount.toFixed(2)}`));

    const inCSVNotInGraphQL: string[] = [];
    for (const item of csvItems) {
        const key = `${item.orderName}|${item.title}|${item.amount.toFixed(2)}`;
        if (!graphqlSet.has(key)) {
            inCSVNotInGraphQL.push(`${item.orderName}: ${item.title} = $${item.amount.toFixed(2)}`);
        }
    }

    if (inCSVNotInGraphQL.length > 0) {
        console.log("\nItems in CSV but NOT in GraphQL:");
        console.log("-".repeat(80));
        for (const item of inCSVNotInGraphQL) {
            console.log(item);
        }
    }
}

compareWithCSV()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
