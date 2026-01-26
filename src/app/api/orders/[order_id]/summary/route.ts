import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { authorizeServiceRequest } from "@/lib/core/auth/authorize-service";
import { getOrderDetails, orderDetailsSchema } from "@/lib/core/orders/order-summary-helpers";
import { buildResourceGid } from "@/lib/utils";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { type NextRequest, NextResponse } from "next/server";

/**
 * GET /api/orders/[order_id]/summary
 *
 * Returns comprehensive order details for CS bot integration.
 * Requires service authentication via OROCHI_SECRET Bearer token.
 *
 * @example
 * curl -H "Authorization: Bearer <OROCHI_SECRET>" \
 *   http://localhost:3000/api/orders/6396384280790/summary
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate service request
    const isAuthorized = await authorizeServiceRequest();
    if (!isAuthorized) {
      return NextResponse.json(
        { status: "failed", message: "not authorized" },
        { status: 401 }
      );
    }

    const { order_id } = await params;
    const orderId = buildResourceGid("Order", order_id);

    // Fetch order from database with shipments
    const order = await db.query.orders.findFirst({
      where: { id: orderId },
      with: {
        shipments: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { status: "failed", message: "Order not found" },
        { status: 404 }
      );
    }

    // Fetch Shopify order data
    const { data: shopifyOrder } = await shopify.request(orderQuery, {
      variables: { id: orderId },
    });

    if (!shopifyOrder?.node || shopifyOrder.node.__typename !== "Order") {
      return NextResponse.json(
        { status: "failed", message: "Shopify order not found" },
        { status: 404 }
      );
    }

    // Build comprehensive order details
    const orderDetails = await getOrderDetails(order, {
      __typename: "Order" as const,
      name: shopifyOrder.node.name,
      cancelledAt: shopifyOrder.node.cancelledAt,
    });

    // Validate response schema
    const { success: isValid } = orderDetailsSchema.safeParse(orderDetails);
    if (!isValid) {
      console.error("Order details schema validation failed", orderDetails);
      return NextResponse.json(
        { status: "failed", message: "Invalid order details format" },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "success", orderDetails });
  } catch (error) {
    console.error("Error in order summary endpoint:", error);
    return NextResponse.json(
      { status: "failed", message: "Error unknown." },
      { status: 500 }
    );
  }
}
