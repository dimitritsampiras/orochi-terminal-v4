/**
 * Analyze refund line item amounts to find reversals
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const EASTERN_TIMEZONE = "America/New_York";

async function analyzeRefundAmounts() {
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    // Helper to fetch order IDs
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

        while (hasNextPage && pageCount < 20) {
            pageCount++;
            const after: string = cursor ? `, after: "${cursor}"` : "";
            const paginatedQuery = ordersQuery.replace('orders(first: 250, query: $query)', `orders(first: 250, query: $query${after})`);

            const { data, errors } = await shopify.request(paginatedQuery, {
                variables: { query },
            });

            if (errors) {
                console.error(`Errors (${label}) page ${pageCount}:`, errors);
                break;
            }

            const edges = data?.orders?.edges || [];
            edges.forEach((edge: any) => ids.add(edge.node.id));

            hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;
            cursor = data?.orders?.pageInfo?.endCursor || null;
        }
        console.log(`Fetched ${ids.size} order IDs (${label})`);
        return ids;
    };

    // Fetch all order IDs
    console.log("Fetching order IDs...\n");
    const [createdOrderIds, updatedOrderIds] = await Promise.all([
        fetchOrderIds(`created_at:>='${startISO}' created_at:<='${endISO}'`, "CREATED"),
        fetchOrderIds(`updated_at:>='${startISO}' updated_at:<='${endISO}'`, "UPDATED")
    ]);

    const allOrderIds = new Set([...createdOrderIds, ...updatedOrderIds]);
    const orderIds = Array.from(allOrderIds);
    console.log(`Total unique orders: ${orderIds.length}\n`);

    // Fetch order details in batches
    const detailsQuery = `#graphql
        query GetOrderDetails($ids: [ID!]!) {
            nodes(ids: $ids) {
                __typename
                ... on Order {
                    id
                    name
                    refunds {
                        id
                        createdAt
                        note
                        totalRefundedSet {
                            shopMoney {
                                amount
                            }
                        }
                        transactions(first: 10) {
                            nodes {
                                id
                                kind
                                status
                                amountSet {
                                    shopMoney {
                                        amount
                                    }
                                }
                            }
                        }
                        refundLineItems(first: 50) {
                            nodes {
                                subtotalSet {
                                    shopMoney {
                                        amount
                                    }
                                }
                                quantity
                                lineItem {
                                    id
                                    title
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    console.log("Fetching order details...\n");
    const BATCH_SIZE = 50;
    const allRefunds: Array<{
        orderName: string;
        refundId: string;
        refundDate: Date;
        totalRefunded: number;
        note: string | null;
        transactions: Array<{ kind: string; status: string; amount: number }>;
        lineItems: Array<{
            title: string;
            quantity: number;
            subtotal: number;
        }>;
    }> = [];

    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batch = orderIds.slice(i, i + BATCH_SIZE);
        const { data, errors } = await shopify.request(detailsQuery, {
            variables: { ids: batch },
        });

        if (errors) {
            console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} errors:`, JSON.stringify(errors, null, 2));
            continue;
        }

        const nodes = data?.nodes || [];
        for (const node of nodes) {
            if (!node || node.__typename !== "Order") continue;
            if (!node.refunds || node.refunds.length === 0) continue;

            for (const refund of node.refunds) {
                const refundDate = new Date(refund.createdAt);
                if (refundDate >= weekStart && refundDate <= weekEnd) {
                    const totalRefunded = parseFloat(refund.totalRefundedSet?.shopMoney?.amount || "0");
                    const lineItems: Array<{ title: string; quantity: number; subtotal: number }> = [];
                    const transactions: Array<{ kind: string; status: string; amount: number }> = [];

                    if (refund.refundLineItems?.nodes) {
                        for (const item of refund.refundLineItems.nodes) {
                            lineItems.push({
                                title: item.lineItem?.title || "Unknown",
                                quantity: item.quantity || 0,
                                subtotal: parseFloat(item.subtotalSet?.shopMoney?.amount || "0"),
                            });
                        }
                    }

                    if (refund.transactions?.nodes) {
                        for (const txn of refund.transactions.nodes) {
                            transactions.push({
                                kind: txn.kind || "unknown",
                                status: txn.status || "unknown",
                                amount: parseFloat(txn.amountSet?.shopMoney?.amount || "0"),
                            });
                        }
                    }

                    allRefunds.push({
                        orderName: node.name,
                        refundId: refund.id,
                        refundDate,
                        totalRefunded,
                        note: refund.note || null,
                        transactions,
                        lineItems,
                    });
                }
            }
        }
    }

    console.log(`Found ${allRefunds.length} refunds in the period\n`);
    console.log("=".repeat(100));
    console.log("Detailed Refund Analysis:");
    console.log("=".repeat(100));

    let totalReturnsAll = 0;
    let totalReturnsFiltered = 0;
    let negativeLineItems = 0;
    let zeroLineItems = 0;

    for (const refund of allRefunds) {
        const refundDateET = formatInTimeZone(refund.refundDate, EASTERN_TIMEZONE, "yyyy-MM-dd HH:mm:ss");

        console.log(`\n${refund.orderName} - ${refundDateET}`);
        console.log(`  Total Refunded: $${refund.totalRefunded.toFixed(2)}`);
        if (refund.note) {
            console.log(`  Note: ${refund.note}`);
        }
        if (refund.transactions.length > 0) {
            console.log(`  Transactions:`);
            for (const txn of refund.transactions) {
                console.log(`    - ${txn.kind} (${txn.status}): $${txn.amount.toFixed(2)}`);
            }
        }
        console.log(`  Line Items:`);

        let refundItemsTotal = 0;
        for (const item of refund.lineItems) {
            refundItemsTotal += item.subtotal;
            console.log(`    - ${item.title} (qty: ${item.quantity}): $${item.subtotal.toFixed(2)}`);

            if (item.subtotal < 0) negativeLineItems++;
            if (item.subtotal === 0) zeroLineItems++;
        }
        console.log(`  Line Items Total: $${refundItemsTotal.toFixed(2)}`);

        totalReturnsAll += refundItemsTotal;
        if (refund.totalRefunded > 0) {
            totalReturnsFiltered += refundItemsTotal;
        }
    }

    console.log("\n" + "=".repeat(100));
    console.log("Summary:");
    console.log("=".repeat(100));
    console.log(`Total refunds in period:           ${allRefunds.length}`);
    console.log(`Negative line item amounts:        ${negativeLineItems}`);
    console.log(`Zero line item amounts:            ${zeroLineItems}`);
    console.log();
    console.log(`Total Returns (all refunds):       $${totalReturnsAll.toFixed(2)}`);
    console.log(`Total Returns (totalRefunded > 0): $${totalReturnsFiltered.toFixed(2)}`);
    console.log(`Expected (Shopify):                $994.44`);
    console.log();
    console.log(`Difference (all):                  $${(totalReturnsAll - 994.44).toFixed(2)}`);
    console.log(`Difference (filtered):             $${(totalReturnsFiltered - 994.44).toFixed(2)}`);
}

analyzeRefundAmounts()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
