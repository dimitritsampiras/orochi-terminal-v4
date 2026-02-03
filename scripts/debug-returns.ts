/**
 * Debug Returns calculation - find why we're $78.26 too high
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const EASTERN_TIMEZONE = "America/New_York";

async function debugReturns() {
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    console.log("Analyzing Returns for Jan 26 - Feb 1, 2026...\n");

    // Fetch all orders that were CREATED or UPDATED during the week
    const ordersQuery = `#graphql
        query GetOrders($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
                        createdAt
                        refunds {
                            id
                            createdAt
                            totalRefundedSet {
                                shopMoney {
                                    amount
                                }
                            }
                            refundLineItems(first: 50) {
                                nodes {
                                    subtotalSet {
                                        shopMoney {
                                            amount
                                        }
                                    }
                                    totalTaxSet {
                                        shopMoney {
                                            amount
                                        }
                                    }
                                    quantity
                                }
                            }
                            refundShippingLines(first: 10) {
                                nodes {
                                    subtotalAmountSet {
                                        shopMoney {
                                            amount
                                        }
                                    }
                                    taxAmountSet {
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
        }
    `;

    // Query both CREATED and UPDATED orders (to catch refunds)
    const createdQuery = `created_at:>='${startISO}' created_at:<='${endISO}'`;
    const updatedQuery = `updated_at:>='${startISO}' updated_at:<='${endISO}'`;

    console.log("Fetching CREATED orders...");
    const { data: createdData } = await shopify.request(ordersQuery, {
        variables: { query: createdQuery },
    });

    console.log("Fetching UPDATED orders...");
    const { data: updatedData } = await shopify.request(ordersQuery, {
        variables: { query: updatedQuery },
    });

    // Merge and deduplicate orders
    const allOrders = new Map();
    const createdOrders = createdData?.orders?.edges || [];
    const updatedOrders = updatedData?.orders?.edges || [];

    for (const edge of [...createdOrders, ...updatedOrders]) {
        allOrders.set(edge.node.id, edge.node);
    }

    console.log(`Total unique orders: ${allOrders.size}\n`);

    // Analyze refunds
    let totalReturns = 0;
    let refundsInPeriod = 0;
    const refundDetails: Array<{
        orderName: string;
        refundDate: string;
        itemsReturned: number;
        refundAmount: number;
    }> = [];

    for (const order of allOrders.values()) {
        if (order.refunds && order.refunds.length > 0) {
            for (const refund of order.refunds) {
                const refundDate = new Date(refund.createdAt);

                // Check if refund happened in the requested week
                if (refundDate >= weekStart && refundDate <= weekEnd) {
                    refundsInPeriod++;

                    // Calculate returns value (sum of refund line items subtotal)
                    let itemsReturnValue = 0;
                    if (refund.refundLineItems?.nodes) {
                        itemsReturnValue = refund.refundLineItems.nodes.reduce((sum: number, item: any) => {
                            return sum + parseFloat(item.subtotalSet?.shopMoney?.amount || "0");
                        }, 0);
                    }

                    totalReturns += itemsReturnValue;

                    const refundDateET = formatInTimeZone(
                        refundDate,
                        EASTERN_TIMEZONE,
                        "yyyy-MM-dd HH:mm:ss zzz"
                    );

                    refundDetails.push({
                        orderName: order.name,
                        refundDate: refundDateET,
                        itemsReturned: itemsReturnValue,
                        refundAmount: parseFloat(refund.totalRefundedSet?.shopMoney?.amount || "0"),
                    });
                }
            }
        }
    }

    console.log("Returns Breakdown:");
    console.log("=".repeat(80));
    console.log(`Total Refunds in Period: ${refundsInPeriod}`);
    console.log(`Total Returns Value: $${totalReturns.toFixed(2)}`);
    console.log("");
    console.log("Individual Refunds:");
    console.log("-".repeat(80));

    for (const detail of refundDetails) {
        console.log(
            `${detail.orderName.padEnd(15)} ${detail.refundDate.padEnd(30)} ` +
            `Items: $${detail.itemsReturned.toFixed(2).padStart(8)} | ` +
            `Total: $${detail.refundAmount.toFixed(2).padStart(8)}`
        );
    }

    console.log("-".repeat(80));
    console.log("");
    console.log("Expected (Shopify Analytics): $994.44");
    console.log(`Calculated Returns:           $${totalReturns.toFixed(2)}`);
    console.log(`Difference:                   $${(totalReturns - 994.44).toFixed(2)}`);
}

debugReturns()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
