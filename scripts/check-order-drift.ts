/**
 * Check for order drift - orders in Shopify but not in local DB
 * Queries the last 5000 orders from Shopify and checks which are missing from the database
 * 
 * Run with: npx tsx -r dotenv/config scripts/check-order-drift.ts
 */

import shopify from "@/lib/clients/shopify";
import { db } from "@/lib/clients/db";
import { orders } from "@drizzle/schema";
import { inArray } from "drizzle-orm";

const BATCH_SIZE = 250;
const MAX_ORDERS = 10000;

async function checkOrderDrift() {
    console.log("Fetching last 5000 orders from Shopify...\n");

    // Query to get order IDs sorted by creation date (newest first)
    const ordersQuery = `#graphql
        query GetOrders($query: String!, $after: String) {
            orders(first: 250, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
                edges {
                    node {
                        id
                        name
                        createdAt
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
    `;

    const shopifyOrders: { id: string; name: string; createdAt: string }[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    let pageCount = 0;

    while (hasNextPage && shopifyOrders.length < MAX_ORDERS) {
        pageCount++;
        try {
            const response = await shopify.request(ordersQuery, {
                variables: {
                    query: "", // No filter - get all orders
                    after: cursor
                },
            }) as { data?: { orders?: { edges?: { node: { id: string; name: string; createdAt: string } }[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string } } }; errors?: unknown };
            const data = response.data;
            const errors = response.errors;

            if (errors) {
                console.error(`Shopify GraphQL errors on page ${pageCount}:`, errors);
                break;
            }

            const edges = data?.orders?.edges || [];
            for (const edge of edges) {
                if (shopifyOrders.length >= MAX_ORDERS) break;
                shopifyOrders.push({
                    id: edge.node.id,
                    name: edge.node.name,
                    createdAt: edge.node.createdAt,
                });
            }

            console.log(`Page ${pageCount}: fetched ${edges.length} orders (total: ${shopifyOrders.length})`);

            hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;
            cursor = data?.orders?.pageInfo?.endCursor || null;

            if (pageCount > 50) {
                console.warn(`Stopping after ${pageCount} pages`);
                break;
            }
        } catch (error) {
            console.error(`Error fetching page ${pageCount}:`, error);
            break;
        }
    }

    console.log(`\nTotal Shopify orders fetched: ${shopifyOrders.length}\n`);

    // Check which orders exist in the database
    console.log("Checking which orders exist in local DB...\n");

    const shopifyOrderIds = shopifyOrders.map(o => o.id);

    // Query in batches to avoid hitting DB limits
    const DB_BATCH_SIZE = 500;
    const existingOrderIds = new Set<string>();

    for (let i = 0; i < shopifyOrderIds.length; i += DB_BATCH_SIZE) {
        const batch = shopifyOrderIds.slice(i, i + DB_BATCH_SIZE);
        const dbOrders = await db
            .select({ id: orders.id })
            .from(orders)
            .where(inArray(orders.id, batch));

        dbOrders.forEach(o => existingOrderIds.add(o.id));
    }

    console.log(`Orders found in DB: ${existingOrderIds.size}`);

    // Find missing orders
    const missingOrders = shopifyOrders.filter(o => !existingOrderIds.has(o.id));

    console.log(`Orders missing from DB: ${missingOrders.length}\n`);

    if (missingOrders.length > 0) {
        console.log("=".repeat(80));
        console.log("MISSING ORDER IDs (one per line):");
        console.log("=".repeat(80));
        for (const order of missingOrders) {
            // Extract just the numeric ID from the GID
            const numericId = order.id.replace('gid://shopify/Order/', '');
            console.log(`${numericId} (${order.name}, ${order.createdAt})`);
        }
        console.log("=".repeat(80));
    } else {
        console.log("✓ All Shopify orders exist in local DB!");
    }

    // Summary
    console.log("\nSummary:");
    console.log(`- Shopify orders checked: ${shopifyOrders.length}`);
    console.log(`- Found in DB: ${existingOrderIds.size}`);
    console.log(`- Missing from DB: ${missingOrders.length}`);
}

checkOrderDrift()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
