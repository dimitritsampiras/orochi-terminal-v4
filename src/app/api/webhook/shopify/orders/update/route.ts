import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { logger } from "@/lib/core/logger";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { buildResourceGid } from "@/lib/utils";
import { lineItems, orders } from "@drizzle/schema";
import { eq, sql } from "drizzle-orm";
import z from "zod";

export async function POST(request: Request) {
  // Schema to handle both order edit and regular order update payloads
  const orderUpdateSchema = z.union([
    // Order edit payload
    z.object({
      order_edit: z.object({
        order_id: z.number(),
      }),
    }),
    // Regular order update payload
    z.object({
      admin_graphql_api_id: z.string(),
    }),
  ]);

  const body = await request.json();

  const parsedBody = orderUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    logger.error("[order update webhook] Invalid request body", {
      category: "AUTOMATED",
      metadata: JSON.stringify(body).slice(0, 5000),
    });
    return new Response("Invalid request body", { status: 400 });
  }

  // Extract admin_graphql_api_id from either payload type
  let adminGraphqlApiId: string;

  if ("order_edit" in parsedBody.data) {
    // Convert numeric order_id to GraphQL ID format
    adminGraphqlApiId = buildResourceGid("Order", parsedBody.data.order_edit.order_id);
  } else {
    adminGraphqlApiId = parsedBody.data.admin_graphql_api_id;
  }

  const existingOrder = await db.query.orders.findFirst({
    where: {
      id: adminGraphqlApiId,
    },
  });

  if (!existingOrder) {
    logger.warn(`[order update webhook] Order ${adminGraphqlApiId} doesn't exist`, {
      category: "AUTOMATED",
      metadata: JSON.stringify(existingOrder).slice(0, 5000),
    });
    return new Response("Order doesn't exist", { status: 404 });
  }

  const { data, errors } = await shopify.request(orderQuery, {
    variables: { id: adminGraphqlApiId },
  });

  if (errors || !data?.node || data.node?.__typename !== "Order") {
    logger.error("[order update webhook] Error fetching shopify order", {
      category: "AUTOMATED",
      metadata: JSON.stringify(errors).slice(0, 5000),
    });
    return new Response("Error fetching order", { status: 400 });
  }

  const order = data.node;

  if (order.lineItems.nodes.length >= 25) {
    logger.error("[order update webhook] Lineitem gql query limit reached at 25.", {
      category: "AUTOMATED",
      orderId: order.id,
    });
  }

  await db.transaction(async (tx) => {
    // Update order with latest data from Shopify
    await tx
      .update(orders)
      .set({
        displayFulfillmentStatus: order.displayFulfillmentStatus,
        name: order.name,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        displayCustomerName: `${order.customer?.firstName ?? ""} ${order.customer?.lastName ?? ""}`.trim(),
        displayDestinationCountryCode: order.shippingAddress?.countryCodeV2,
        displayDestinationCountryName: order.shippingAddress?.country,
        displayIsCancelled: order.cancelledAt !== null,
      })
      .where(eq(orders.id, adminGraphqlApiId));

    // Upsert line items: insert new ones or update existing ones
    // We don't delete removed line items as per requirements
    if (order.lineItems.nodes.length > 0) {
      for (const item of order.lineItems.nodes) {
        await tx
          .insert(lineItems)
          .values({
            id: item.id,
            name: item.name,
            orderId: order.id,
            variantId: item.variant?.id,
            productId: item.product?.id,
            quantity: item.quantity ?? 1,
            unfulfilledQuantity: item.unfulfilledQuantity,
            requiresShipping: item.requiresShipping,
          })
          .onConflictDoUpdate({
            target: lineItems.id,
            set: {
              name: item.name,
              orderId: order.id,
              variantId: item.variant?.id,
              productId: item.product?.id,
              quantity: item.quantity ?? 1,
              unfulfilledQuantity: item.unfulfilledQuantity,
              requiresShipping: item.requiresShipping,
              updatedAt: sql`now()`,
            },
          });
      }
    }
  });

  return new Response("OK");
}
