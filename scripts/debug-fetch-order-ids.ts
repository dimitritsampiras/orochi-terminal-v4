/**
 * Debug the fetchOrderIds function to see what IDs are being collected
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime } from "date-fns-tz";

const EASTERN_TIMEZONE = "America/New_York";

async function debugFetchOrderIds() {
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    // Replicate the fetchOrderIds function from the main calculation
    const ordersQuery = `#graphql
        query GetOrders($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
    `;

    const fetchOrderIds = async (query: string, label: string): Promise<Set<string>> => {
        const ids = new Set<string>();
        let hasNextPage = true;
        let cursor: string | null = null;
        let pageCount = 0;

        while (hasNextPage) {
            pageCount++;
            try {
                const after: string = cursor ? `, after: "${cursor}"` : "";
                const paginatedQuery: string = ordersQuery.replace('orders(first: 250, query: $query)', `orders(first: 250, query: $query${after})`);

                const { data, errors } = await shopify.request(paginatedQuery, {
                    variables: { query },
                });

                if (errors) {
                    console.error(`Shopify GraphQL errors (${label}) page ${pageCount}:`, errors);
                    break;
                }

                const edges = data?.orders?.edges || [];
                console.log(`${label} page ${pageCount}: ${edges.length} orders`);
                edges.forEach((edge: any) => ids.add(edge.node.id));

                hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;
                cursor = data?.orders?.pageInfo?.endCursor || null;

                if (pageCount > 20) {
                    console.warn(`Stopping (${label}) after ${pageCount} pages`);
                    break;
                }
            } catch (error) {
                console.error(`Error fetching (${label}) page ${pageCount}:`, error);
                break;
            }
        }
        console.log(`Total ${label} IDs: ${ids.size}\n`);
        return ids;
    };

    // Fetch order IDs
    console.log("Fetching CREATED order IDs...\n");
    const createdOrderIds = await fetchOrderIds(`created_at:>='${startISO}' created_at:<='${endISO}'`, "CREATED");

    // Now fetch full details for these orders using nodes() query
    const orderIds = Array.from(createdOrderIds);

    const detailsQuery = `#graphql
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

    console.log(`Fetching details for ${orderIds.length} orders in batches...\n`);

    const BATCH_SIZE = 50;
    let grossSales = 0;
    let lineItemCount = 0;
    let orderCount = 0;
    let nullNodeCount = 0;
    let nonOrderTypeCount = 0;

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);
        const { data, errors } = await shopify.request(detailsQuery, {
            variables: { ids: batch },
        });

        if (errors) {
            console.error(`Batch errors:`, errors);
            continue;
        }

        const nodes = data?.nodes || [];
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: fetched ${nodes.length} nodes`);

        for (const node of nodes) {
            if (!node) {
                nullNodeCount++;
                continue;
            }
            if (node.__typename !== "Order") {
                nonOrderTypeCount++;
                console.log(`Non-Order type: ${node.__typename}`);
                continue;
            }

            orderCount++;

            if (node.lineItems?.nodes) {
                for (const lineItem of node.lineItems.nodes) {
                    lineItemCount++;
                    const originalUnitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
                    const quantity = lineItem.quantity || 0;
                    grossSales += originalUnitPrice * quantity;
                }
            }
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("Results:");
    console.log("=".repeat(80));
    console.log(`Order IDs fetched: ${orderIds.length}`);
    console.log(`Orders processed: ${orderCount}`);
    console.log(`Null nodes skipped: ${nullNodeCount}`);
    console.log(`Non-Order types skipped: ${nonOrderTypeCount}`);
    console.log(`Line items processed: ${lineItemCount}`);
    console.log(`Gross Sales: $${grossSales.toFixed(2)}`);
    console.log("");
    console.log(`Expected: $15,294.42`);
    console.log(`Difference: $${(15294.42 - grossSales).toFixed(2)}`);
}

debugFetchOrderIds()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
