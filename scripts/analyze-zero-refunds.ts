/**
 * Analyze refunds with $0 total to see if they should be excluded
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

const EASTERN_TIMEZONE = "America/New_York";

async function analyzeZeroRefunds() {
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    // Query orders updated during the week
    const ordersQuery = `#graphql
        query GetOrders($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
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
                                }
                            }
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
    `;

    const updatedQuery = `updated_at:>='${startISO}' updated_at:<='${endISO}'`;

    console.log("Fetching orders updated during the week...\n");
    const { data } = await shopify.request(ordersQuery, {
        variables: { query: updatedQuery },
    });

    const orders = data?.orders?.edges || [];

    let returnsWithZeroTotal = 0;
    let returnsWithNonZeroTotal = 0;
    let valueWithZeroTotal = 0;
    let valueWithNonZeroTotal = 0;

    console.log("Refunds with $0 total refund amount:");
    console.log("-".repeat(80));

    for (const edge of orders) {
        const order = edge.node;

        if (order.refunds && order.refunds.length > 0) {
            for (const refund of order.refunds) {
                const refundDate = new Date(refund.createdAt);

                if (refundDate >= weekStart && refundDate <= weekEnd) {
                    const totalRefundAmount = parseFloat(refund.totalRefundedSet?.shopMoney?.amount || "0");
                    let itemsValue = 0;

                    if (refund.refundLineItems?.nodes) {
                        itemsValue = refund.refundLineItems.nodes.reduce((sum: number, item: any) => {
                            return sum + parseFloat(item.subtotalSet?.shopMoney?.amount || "0");
                        }, 0);
                    }

                    if (totalRefundAmount === 0 && itemsValue > 0) {
                        returnsWithZeroTotal++;
                        valueWithZeroTotal += itemsValue;

                        const refundDateET = formatInTimeZone(refundDate, EASTERN_TIMEZONE, "yyyy-MM-dd HH:mm:ss");
                        console.log(`${order.name}: Items value $${itemsValue.toFixed(2)}, Total refund $${totalRefundAmount.toFixed(2)} (${refundDateET})`);
                    } else if (itemsValue > 0) {
                        returnsWithNonZeroTotal++;
                        valueWithNonZeroTotal += itemsValue;
                    }
                }
            }
        }
    }

    console.log("-".repeat(80));
    console.log("");
    console.log("Summary:");
    console.log(`Refunds with $0 total:     ${returnsWithZeroTotal} refunds, $${valueWithZeroTotal.toFixed(2)} items value`);
    console.log(`Refunds with non-$0 total: ${returnsWithNonZeroTotal} refunds, $${valueWithNonZeroTotal.toFixed(2)} items value`);
    console.log("");
    console.log(`If we exclude $0 refunds, Returns would be: $${valueWithNonZeroTotal.toFixed(2)}`);
    console.log(`Current Returns calculation:                $1,072.70`);
    console.log(`Expected (Shopify):                         $994.44`);
    console.log(`Difference if excluding $0 refunds:         $${(valueWithNonZeroTotal - 994.44).toFixed(2)}`);
}

analyzeZeroRefunds()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
