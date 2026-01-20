import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { logger } from "@/lib/core/logger";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { fulfillmentPriority, lineItems, orders, shippingPriority } from "@drizzle/schema";
import z from "zod";

export async function POST(request: Request) {
  // const body = await request.json();
  // console.log(body);

  const orderCreateSchema = z.object({
    admin_graphql_api_id: z.string(),
  });

  const body = await request.json();

  const parsedBody = orderCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    logger.error("[order create webhook] Invalid request body", {
      metadata: JSON.stringify(body).slice(0, 5000),
    });
    return new Response("Invalid request body", { status: 400 });
  }

  const { admin_graphql_api_id } = parsedBody.data;

  const existingOrder = await db.query.orders.findFirst({
    where: {
      id: admin_graphql_api_id,
    },
  });

  if (existingOrder) {
    logger.warn(`[order create webhook] Order ${admin_graphql_api_id} already exists`, {
      metadata: JSON.stringify(existingOrder).slice(0, 5000),
    });
    return new Response("Order already exists", { status: 200 });
  }

  const { data, errors } = await shopify.request(orderQuery, {
    variables: { id: admin_graphql_api_id },
  });

  if (errors || !data?.node || data.node?.__typename !== "Order") {
    logger.error("[order create webhook] Error fetching shopify order", {
      metadata: JSON.stringify(errors).slice(0, 5000),
    });
    return new Response("Error fetching order", { status: 400 });
  }

  const order = data.node;

  if (order.lineItems.nodes.length >= 25) {
    logger.error("[order create webhook] Lineitem gql query limit reached at 25.", {
      category: "AUTOMATED",
      orderId: order.id,
    });
  }

  await db.transaction(async (tx) => {
    await tx.insert(orders).values({
      displayFulfillmentStatus: order.displayFulfillmentStatus,
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      displayCustomerName: `${order.customer?.firstName ?? ""} ${order.customer?.lastName ?? ""}`.trim(),
      displayDestinationCountryCode: order.shippingAddress?.countryCodeV2,
      displayDestinationCountryName: order.shippingAddress?.country,
      displayIsCancelled: order.cancelledAt !== null,
      fulfillmentPriority: determineFulfillmentPriority(order),
      queued: true,
      shippingPriority: determineShippingPriority(order),
    });

    await tx.insert(lineItems).values(
      order.lineItems.nodes.map<typeof lineItems.$inferInsert>((item) => ({
        id: item.id,
        name: item.name,
        orderId: order.id,
        variantId: item.variant?.id,
        productId: item.product?.id,
        quantity: item.quantity ?? 1,
        unfulfilledQuantity: item.unfulfilledQuantity,
      }))
    );
  });

  return new Response("OK");
}

const determineFulfillmentPriority = (
  order: Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>
): (typeof fulfillmentPriority.enumValues)[number] => {
  if (order.discountCodes?.some((code) => code.toLowerCase().includes("norush"))) {
    return "low";
  }

  const customerPrestigeStatus = order.customer?.tags
    ?.find((tag) => tag.startsWith("PRESTIGE:TIER:"))
    ?.split(":")
    .pop();

  const totalPrice = order.totalPriceSet?.shopMoney?.amount;
  const priceAsNumber = totalPrice ? Number(totalPrice) : 0;

  if (customerPrestigeStatus === "VIP") {
    logger.info("Order was set to critical priority because customer is VIP", {
      category: "AUTOMATED",
    });
    return "critical";
  }

  if (order.app?.name === "TikTok") {
    logger.info("Order was set to critical priority because it is from TikTok", {
      category: "AUTOMATED",
    });
    return "urgent";
  }

  if (priceAsNumber > 300) {
    logger.info("Order was set to priority because customer is high spender", {
      category: "AUTOMATED",
    });
    return "urgent";
  }

  if (customerPrestigeStatus && ["GOLD", "SILVER", "PLATINUM"].includes(customerPrestigeStatus)) {
    logger.info("Order was set to priority priority due to loyalty tier", {
      category: "AUTOMATED",
    });
    return "priority";
  }

  // if order has care package
  if (order.lineItems.nodes.some((item) => item.name.toLowerCase().includes("care package"))) {
    logger.info("Order was set to priority because it contains a care package", {
      category: "AUTOMATED",
    });
    return "priority";
  }

  if (priceAsNumber > 150) {
    logger.info("Order was set to priority because customer is a medium-high spender", {
      category: "AUTOMATED",
    });
    return "priority";
  }

  const customerOrderNumber = parseInt(order.customer?.numberOfOrders ?? "0");
  if (customerOrderNumber > 3) {
    logger.info("Order was set to priority because customer has multiple orders", {
      category: "AUTOMATED",
    });
    return "priority";
  }

  return "normal";
};

const determineShippingPriority = (
  order: Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>
): (typeof shippingPriority.enumValues)[number] => {
  const shippingLineTitle = order.shippingLine?.title?.toLowerCase();
  if (!shippingLineTitle) {
    return "standard";
  }

  if (shippingLineTitle.includes("express")) {
    return "express";
  }

  if (shippingLineTitle.includes("expedited") || shippingLineTitle.includes("fastest")) {
    return "fastest";
  }

  return "standard";
};
