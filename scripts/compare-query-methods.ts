/**
 * Compare Gross Sales between simple orders query and nodes() batch query
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime } from "date-fns-tz";

const EASTERN_TIMEZONE = "America/New_York";

async function compareQueryMethods() {
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    console.log("=".repeat(80));
    console.log("Method 1: Simple orders() query");
    console.log("=".repeat(80));

    // Method 1: Simple orders query (like debug scripts)
    const simpleQuery = `#graphql
        query GetOrders($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
                        lineItems(first: 250) {
                            nodes {
                                id
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

    const { data: simpleData } = await shopify.request(simpleQuery, {
        variables: { query: `created_at:>='${startISO}' created_at:<='${endISO}'` },
    });

    const simpleOrders = simpleData?.orders?.edges || [];
    let simpleGrossSales = 0;
    let simpleLineItemCount = 0;
    const simpleOrderIds: string[] = [];

    for (const edge of simpleOrders) {
        const order = edge.node;
        simpleOrderIds.push(order.id);

        if (order.lineItems?.nodes) {
            for (const lineItem of order.lineItems.nodes) {
                simpleLineItemCount++;
                const originalUnitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
                const quantity = lineItem.quantity || 0;
                simpleGrossSales += originalUnitPrice * quantity;
            }
        }
    }

    console.log(`Orders found: ${simpleOrders.length}`);
    console.log(`Line items: ${simpleLineItemCount}`);
    console.log(`Gross Sales: $${simpleGrossSales.toFixed(2)}\n`);

    console.log("=".repeat(80));
    console.log("Method 2: nodes() batch query (like main calculation)");
    console.log("=".repeat(80));

    // Method 2: Batch nodes() query (like main calculation)
    const nodesQuery = `#graphql
        query GetOrderDetails($ids: [ID!]!) {
            nodes(ids: $ids) {
                __typename
                ... on Order {
                    id
                    name
                    lineItems(first: 250) {
                        nodes {
                            id
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
    `;

    const BATCH_SIZE = 50;
    let nodesGrossSales = 0;
    let nodesLineItemCount = 0;
    let nodesOrderCount = 0;

    for (let i = 0; i < simpleOrderIds.length; i += BATCH_SIZE) {
        const batch = simpleOrderIds.slice(i, i + BATCH_SIZE);
        const { data: nodesData } = await shopify.request(nodesQuery, {
            variables: { ids: batch },
        });

        const nodes = nodesData?.nodes || [];
        for (const node of nodes) {
            if (!node || node.__typename !== "Order") continue;
            nodesOrderCount++;

            if (node.lineItems?.nodes) {
                for (const lineItem of node.lineItems.nodes) {
                    nodesLineItemCount++;
                    const originalUnitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
                    const quantity = lineItem.quantity || 0;
                    nodesGrossSales += originalUnitPrice * quantity;
                }
            }
        }
    }

    console.log(`Orders processed: ${nodesOrderCount}`);
    console.log(`Line items: ${nodesLineItemCount}`);
    console.log(`Gross Sales: $${nodesGrossSales.toFixed(2)}\n`);

    console.log("=".repeat(80));
    console.log("Comparison:");
    console.log("=".repeat(80));
    console.log(`Order count difference: ${simpleOrders.length - nodesOrderCount}`);
    console.log(`Line item count difference: ${simpleLineItemCount - nodesLineItemCount}`);
    console.log(`Gross Sales difference: $${(simpleGrossSales - nodesGrossSales).toFixed(2)}`);
    console.log("");
    console.log(`Expected (Shopify): $15,294.42`);
    console.log(`Method 1 difference: $${(15294.42 - simpleGrossSales).toFixed(2)}`);
    console.log(`Method 2 difference: $${(15294.42 - nodesGrossSales).toFixed(2)}`);
}

compareQueryMethods()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
