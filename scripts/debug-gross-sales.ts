/**
 * Debug Gross Sales calculation - compare different methods
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";
import { fromZonedTime } from "date-fns-tz";

const EASTERN_TIMEZONE = "America/New_York";

async function debugGrossSales() {
    const weekStart = fromZonedTime("2026-01-26 00:00:00", EASTERN_TIMEZONE);
    const weekEnd = fromZonedTime("2026-02-01 23:59:59.999", EASTERN_TIMEZONE);

    const startISO = weekStart.toISOString();
    const endISO = weekEnd.toISOString();

    console.log("Fetching orders for Jan 26 - Feb 1, 2026 (Eastern Time)...\n");

    // Fetch orders with detailed line item info
    const ordersQuery = `#graphql
        query GetOrdersByDateRange($query: String!) {
            orders(first: 250, query: $query) {
                edges {
                    node {
                        id
                        name
                        createdAt
                        subtotalPriceSet {
                            shopMoney {
                                amount
                            }
                        }
                        totalDiscountsSet {
                            shopMoney {
                                amount
                            }
                        }
                        lineItems(first: 250) {
                            nodes {
                                id
                                quantity
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

    // Calculate different gross sales methods
    let method1 = 0; // subtotalPriceSet + totalDiscountsSet
    let method2 = 0; // Sum of originalTotalSet
    let method3 = 0; // Sum of originalUnitPriceSet × quantity
    let method4 = 0; // Sum of discountedTotalSet

    let totalDiscounts = 0;
    let totalLineItems = 0;

    for (const edge of orders) {
        const order = edge.node;

        // Method 1: Order-level calculation
        const subtotal = parseFloat(order.subtotalPriceSet?.shopMoney?.amount || "0");
        const discounts = parseFloat(order.totalDiscountsSet?.shopMoney?.amount || "0");
        method1 += subtotal + discounts;
        totalDiscounts += discounts;

        // Method 2, 3, 4: Line item calculations
        if (order.lineItems?.nodes) {
            for (const lineItem of order.lineItems.nodes) {
                totalLineItems++;

                const originalTotal = parseFloat(lineItem.originalTotalSet?.shopMoney?.amount || "0");
                method2 += originalTotal;

                const originalUnitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
                const quantity = lineItem.quantity || 0;
                method3 += originalUnitPrice * quantity;

                const discountedTotal = parseFloat(lineItem.discountedTotalSet?.shopMoney?.amount || "0");
                method4 += discountedTotal;
            }
        }
    }

    console.log("Gross Sales Calculation Methods:");
    console.log("=".repeat(60));
    console.log(`Method 1 (subtotal + discounts):     $${method1.toFixed(2)}`);
    console.log(`Method 2 (sum originalTotalSet):     $${method2.toFixed(2)}`);
    console.log(`Method 3 (originalUnitPrice × qty):  $${method3.toFixed(2)}`);
    console.log(`Method 4 (sum discountedTotalSet):   $${method4.toFixed(2)}`);
    console.log("=".repeat(60));
    console.log(`Total Discounts:                     $${totalDiscounts.toFixed(2)}`);
    console.log(`Total Line Items:                    ${totalLineItems}`);
    console.log("");
    console.log("Expected (Shopify Analytics):        $15,294.42");
    console.log("");
    console.log("Differences from Expected:");
    console.log(`Method 1: $${(method1 - 15294.42).toFixed(2)}`);
    console.log(`Method 2: $${(method2 - 15294.42).toFixed(2)}`);
    console.log(`Method 3: $${(method3 - 15294.42).toFixed(2)}`);
    console.log(`Method 4: $${(method4 - 15294.42).toFixed(2)}`);
}

debugGrossSales()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        console.error(error.stack);
        process.exit(1);
    });
