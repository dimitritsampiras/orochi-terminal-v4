/**
 * Find the missing $192.42 in Gross Sales
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime } from "date-fns-tz";

const EASTERN_TIMEZONE = "America/New_York";

async function findMissingRevenue() {
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    console.log("Analyzing line items to find missing $192.42...\n");

    // Fetch orders with ALL possible line item fields
    const ordersQuery = `#graphql
        query GetOrdersDetailed($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
                        totalPriceSet {
                            shopMoney {
                                amount
                            }
                        }
                        lineItems(first: 250) {
                            pageInfo {
                                hasNextPage
                            }
                            nodes {
                                id
                                title
                                quantity
                                variantTitle
                                requiresShipping
                                taxable
                                originalUnitPriceSet {
                                    shopMoney {
                                        amount
                                    }
                                }
                                originalTotalSet {
                                    shopMoney {
                                        amount
                                    }
                                }
                                discountedTotalSet {
                                    shopMoney {
                                        amount
                                    }
                                }
                                duties {
                                    price {
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

    const searchQuery = `created_at:>='${startISO}' created_at:<='${endISO}'`;

    const { data, errors } = await shopify.request(ordersQuery, {
        variables: { query: searchQuery },
    });

    if (errors) {
        console.error("Errors:", errors);
        return;
    }

    const orders = data?.orders?.edges || [];
    console.log(`Found ${orders.length} orders\n`);

    let totalGrossSales = 0;
    let giftCardRevenue = 0;
    let dutiesRevenue = 0;
    let ordersWithMoreLineItems = 0;

    for (const edge of orders) {
        const order = edge.node;

        // Check for pagination
        if (order.lineItems?.pageInfo?.hasNextPage) {
            ordersWithMoreLineItems++;
            console.log(`⚠️  Order ${order.name} has MORE than 250 line items!`);
        }

        if (order.lineItems?.nodes) {
            for (const lineItem of order.lineItems.nodes) {
                const originalUnitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
                const quantity = lineItem.quantity || 0;
                const itemTotal = originalUnitPrice * quantity;

                totalGrossSales += itemTotal;

                // Check for duties
                if (lineItem.duties && lineItem.duties.length > 0) {
                    for (const duty of lineItem.duties) {
                        const dutyAmount = parseFloat(duty.price?.shopMoney?.amount || "0");
                        dutiesRevenue += dutyAmount;
                        console.log(`Duty found: ${order.name} - ${lineItem.title}: $${dutyAmount.toFixed(2)}`);
                    }
                }
            }
        }
    }

    console.log("\nRevenue Breakdown:");
    console.log("=".repeat(60));
    console.log(`Calculated Gross Sales:              $${totalGrossSales.toFixed(2)}`);
    console.log(`Gift Cards:                          $${giftCardRevenue.toFixed(2)}`);
    console.log(`Duties:                              $${dutiesRevenue.toFixed(2)}`);
    console.log(`Orders with >250 line items:         ${ordersWithMoreLineItems}`);
    console.log("=".repeat(60));
    console.log(`Expected (Shopify Analytics):        $15,294.42`);
    console.log(`Difference:                          $${(15294.42 - totalGrossSales).toFixed(2)}`);
    console.log("");

    if (giftCardRevenue > 0) {
        console.log(`Note: Gift cards might be included in Shopify's Gross Sales`);
    }
    if (dutiesRevenue > 0) {
        console.log(`Note: Duties might be included separately`);
    }
}

findMissingRevenue()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
