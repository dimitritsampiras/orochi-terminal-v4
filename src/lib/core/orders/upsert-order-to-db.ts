import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { DataResponse } from "@/lib/types/misc";
import { fulfillmentPriority, lineItems, orders, shippingPriority } from "@drizzle/schema";
import { logger } from "../logger";
import { eq, sql } from "drizzle-orm";


type ShopifyOrder = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;

export const upsertOrderToDb = async (adminGraphqlApiId: string) => {

  const { data } = await shopify.request(orderQuery, {
    variables: { id: adminGraphqlApiId },
  });

  if (!data?.node || data.node?.__typename !== "Order") {
    return { data: null, error: "Error fetching shopify order" };
  }

  const order = data.node;

  if (order.lineItems.nodes.length >= 25) {
    return { data: null, error: "Lineitem gql query limit reached at 25." };
  }


  const existingOrder = await db.query.orders.findFirst({
    where: {
      id: adminGraphqlApiId,
    },
  });

  if (!existingOrder) {
    return createOrder(adminGraphqlApiId, order);
  }

  return updateOrder(existingOrder, order);
};

const updateOrder = async (existingOrder: typeof orders.$inferSelect, shopifyOrder: ShopifyOrder): Promise<DataResponse<"success">> => {
  console.log("[upsertOrderToDb] Updating order in db");
  try {
    await db.transaction(async (tx) => {
      // Update order with latest data from Shopify
      await tx
        .update(orders)
        .set({
          displayFulfillmentStatus: shopifyOrder.displayFulfillmentStatus,
          name: shopifyOrder.name,
          createdAt: new Date(shopifyOrder.createdAt),
          updatedAt: new Date(shopifyOrder.updatedAt),
          displayCustomerName: `${shopifyOrder.customer?.firstName ?? ""} ${shopifyOrder.customer?.lastName ?? ""}`.trim(),
          displayDestinationCountryCode: shopifyOrder.shippingAddress?.countryCodeV2,
          displayDestinationCountryName: shopifyOrder.shippingAddress?.country,
          displayIsCancelled: shopifyOrder.cancelledAt !== null,
        })
        .where(eq(orders.id, existingOrder.id));

      // Upsert line items: insert new ones or update existing ones
      // We don't delete removed line items as per requirements
      if (shopifyOrder.lineItems.nodes.length > 0) {
        await tx
          .insert(lineItems)
          .values(
            shopifyOrder.lineItems.nodes.map((item) => ({
              id: item.id,
              name: item.name,
              orderId: shopifyOrder.id,
              variantId: item.variant?.id,
              productId: item.product?.id,
              quantity: item.quantity ?? 1,
              unfulfilledQuantity: item.unfulfilledQuantity,
              requiresShipping: item.requiresShipping,
            }))
          )
          .onConflictDoUpdate({
            target: lineItems.id,
            set: {
              name: sql.raw(`excluded.${lineItems.name.name}`),
              orderId: sql.raw(`excluded.${lineItems.orderId.name}`),
              variantId: sql.raw(`excluded.${lineItems.variantId.name}`),
              productId: sql.raw(`excluded.${lineItems.productId.name}`),
              quantity: sql.raw(`excluded.${lineItems.quantity.name}`),
              unfulfilledQuantity: sql.raw(`excluded.${lineItems.unfulfilledQuantity.name}`),
              requiresShipping: sql.raw(`excluded.${lineItems.requiresShipping.name}`),
              updatedAt: sql`now()`,
            },
          });
      }
    });
  } catch (error) {
    console.log("[upsertOrderToDb] Error updating order in db", error);

    return { data: null, error: "Error updating order in db" };
  }

  return { data: "success", error: null };
};


const createOrder = async (adminGraphqlApiId: string, shopifyOrder: ShopifyOrder): Promise<DataResponse<"success">> => {

  console.log("[upsertOrderToDb] Creating order in db");

  try {
    const { priority: fulfillmentPriority, displayReason: fulfillmentPriorityReason } = determineFulfillmentPriority(shopifyOrder);
    await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        displayFulfillmentStatus: shopifyOrder.displayFulfillmentStatus,
        id: shopifyOrder.id,
        name: shopifyOrder.name,
        createdAt: new Date(shopifyOrder.createdAt),
        updatedAt: new Date(shopifyOrder.updatedAt),
        displayCustomerName: `${shopifyOrder.customer?.firstName ?? ""} ${shopifyOrder.customer?.lastName ?? ""}`.trim(),
        displayDestinationCountryCode: shopifyOrder.shippingAddress?.countryCodeV2,
        displayDestinationCountryName: shopifyOrder.shippingAddress?.country,
        displayIsCancelled: shopifyOrder.cancelledAt !== null,
        fulfillmentPriority: fulfillmentPriority,
        displayPriorityReason: fulfillmentPriorityReason,
        queued: true,
        shippingPriority: determineShippingPriority(shopifyOrder),
      });

      await tx.insert(lineItems).values(
        shopifyOrder.lineItems.nodes.map<typeof lineItems.$inferInsert>((item) => ({
          id: item.id,
          name: item.name,
          orderId: shopifyOrder.id,
          variantId: item.variant?.id,
          productId: item.product?.id,
          quantity: item.quantity ?? 1,
          unfulfilledQuantity: item.unfulfilledQuantity,
          requiresShipping: item.requiresShipping,
        }))
      );
    });
  } catch (error) {
    console.log("[upsertOrderToDb] Error creating order in db", error);
    return { data: null, error: "Error upserting order to db" };
  }

  return { data: "success", error: null };
};



const determineFulfillmentPriority = (
  order: Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>
): { priority: (typeof fulfillmentPriority.enumValues)[number], displayReason?: string } => {

  if (order.discountCodes?.some((code) => code.toLowerCase().includes("norush"))) {
    logger.info("[upsertOrderToDb] Order was set to low priority because it contains a norush discount code", {
      category: "AUTOMATED",
    });
    return { priority: "low", displayReason: "NORUSH discount was applied" };
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
    return { priority: "urgent", displayReason: "Customer is VIP" };
  }

  if (order.app?.name === "TikTok") {
    logger.info("Order was set to critical priority because it is from TikTok", {
      category: "AUTOMATED",
    });
    return { priority: "urgent" };
  }

  if (priceAsNumber > 300) {
    logger.info("Order was set to priority because customer is high spender", {
      category: "AUTOMATED",
    });
    return { priority: "critical" };
  }

  if (customerPrestigeStatus && ["GOLD", "SILVER", "PLATINUM"].includes(customerPrestigeStatus)) {
    logger.info("Order was set to priority priority due to loyalty tier", {
      category: "AUTOMATED",
    });
    return { priority: "priority", displayReason: `${customerPrestigeStatus} tier priority` };
  }

  // if order has care package
  if (order.lineItems.nodes.some((item) => item.name.toLowerCase().includes("care package"))) {
    logger.info("Order was set to priority because it contains a care package", {
      category: "AUTOMATED",
    });
    return { priority: "priority" };
  }

  if (priceAsNumber > 150) {
    logger.info("Order was set to priority because customer is a medium-high spender", {
      category: "AUTOMATED",
    });
    return { priority: "priority" };
  }

  const customerOrderNumber = parseInt(order.customer?.numberOfOrders ?? "0");
  if (customerOrderNumber > 3) {
    logger.info("Order was set to priority because customer has multiple orders", {
      category: "AUTOMATED",
    });
    return { priority: "priority" };
  }

  return { priority: "normal" };
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
