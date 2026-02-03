import { db } from "@/lib/clients/db";
import { shipments } from "@drizzle/schema";
import { and, inArray, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import shopify from "@/lib/clients/shopify";

/**
 * GET /api/analytics/weekly-profitability/orders-without-shipping
 * Get order IDs that don't have purchased shipping labels
 * 
 * Queries Shopify directly to match the order set used in profitability calculations
 *
 * Query params:
 * - startDate: Week start date
 * - endDate: Week end date
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    try {
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "startDate and endDate are required" },
                { status: 400 }
            );
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Query Shopify directly for orders (matches calculateFulfillmentCosts)
        const startISO = start.toISOString();
        const endISO = end.toISOString();

        const ordersQuery = `#graphql
            query GetOrdersByDateRange($query: String!) {
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

        const weekOrderIds: string[] = [];
        let hasNextPage = true;
        let cursor: string | null = null;
        let pageCount = 0;

        while (hasNextPage) {
            pageCount++;
            const query = `created_at:>='${startISO}' created_at:<='${endISO}'`;
            const after: string = cursor ? `, after: "${cursor}"` : "";
            const paginatedQuery: string = ordersQuery.replace('orders(first: 250, query: $query)', `orders(first: 250, query: $query${after})`);

            try {
                const response = await shopify.request(paginatedQuery, {
                    variables: { query },
                });
                const data = response.data;
                const errors = response.errors;

                if (errors) {
                    console.error(`[orders-without-shipping] Shopify GraphQL errors on page ${pageCount}:`, errors);
                    break;
                }

                const edges = data?.orders?.edges || [];
                const newOrderIds = edges.map((edge: any) => edge.node.id);
                weekOrderIds.push(...newOrderIds);

                hasNextPage = data?.orders?.pageInfo?.hasNextPage || false;
                cursor = data?.orders?.pageInfo?.endCursor || null;

                if (pageCount > 10) {
                    console.warn(`[orders-without-shipping] Stopping after ${pageCount} pages`);
                    break;
                }
            } catch (error) {
                console.error(`[orders-without-shipping] Error fetching page ${pageCount}:`, error);
                break;
            }
        }

        if (weekOrderIds.length === 0) {
            return NextResponse.json({ orderIds: [] });
        }

        // Get orders that have purchased shipments (and not refunded)
        const orderShipments = await db
            .select({
                orderId: shipments.orderId,
            })
            .from(shipments)
            .where(
                and(
                    inArray(shipments.orderId, weekOrderIds),
                    eq(shipments.isPurchased, true),
                    eq(shipments.isRefunded, false)
                )
            );

        // Create a set of order IDs with shipments
        const ordersWithShipments = new Set(
            orderShipments.map((s) => s.orderId)
        );

        // Filter out orders that have shipments
        const ordersWithoutShipments = weekOrderIds.filter(
            (id) => !ordersWithShipments.has(id)
        );

        console.log(`[orders-without-shipping] Total orders: ${weekOrderIds.length}`);
        console.log(`[orders-without-shipping] Orders with shipping: ${ordersWithShipments.size}`);
        console.log(`[orders-without-shipping] Orders without shipping: ${ordersWithoutShipments.length}`);

        return NextResponse.json({
            orderIds: ordersWithoutShipments,
            totalOrders: weekOrderIds.length,
            ordersWithShipping: ordersWithShipments.size,
            ordersWithoutShipping: ordersWithoutShipments.length,
        });
    } catch (error) {
        console.error("Failed to fetch orders without shipping:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal Server Error",
            },
            { status: 500 }
        );
    }
}

