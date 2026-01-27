import shopify from "@/lib/clients/shopify";
import { createFulfillmentMutation, fulfillmentOrdersQuery } from "@/lib/graphql/fulfillment.graphql";
import { FulfillmentTrackingInfo } from "@/lib/types/admin.types";
import { DataResponse } from "@/lib/types/misc";
import dayjs from "dayjs";
import { logger } from "../logger";
import { db } from "@/lib/clients/db";
import { orderHolds } from "@drizzle/schema";
import { eq } from "drizzle-orm";

export const fulfillOrder = async (
  orderId: string,
  trackingInfo: FulfillmentTrackingInfo & {
    orderNumber?: string;
  }
): Promise<DataResponse<"success">> => {
  try {
    const { data, errors } = await shopify.request(fulfillmentOrdersQuery, {
      variables: {
        id: orderId,
      },
    });

    if (!data || data.node?.__typename !== "Order") {
      return { data: null, error: "Order not found" };
    }

    const fulfillmentOrders = data.node.fulfillmentOrders.nodes;
    const validFulfillmentOrders = fulfillmentOrders
      .filter((fo) => fo.status === "OPEN")
      .toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (validFulfillmentOrders.length !== 1) {
      console.log('[fulfillOrder] Multiple or 0 open fulfillment orders found', validFulfillmentOrders);
      return { data: null, error: "Multiple or 0 open fulfillment orders found" };
    }

    const targetFulfillmentOrder = validFulfillmentOrders[0];

    if (targetFulfillmentOrder) {
      console.log("[fulfillOrder] Target fulfillment order:", targetFulfillmentOrder.status, "\nfrom forders:", fulfillmentOrders.length);

      const shouldNotifyCustomer = dayjs().diff(dayjs(targetFulfillmentOrder.createdAt), "day") <= 40;
      const { data, errors } = await shopify.request(createFulfillmentMutation, {
        variables: {
          fulfillment: {
            trackingInfo,
            lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: targetFulfillmentOrder.id }],
            notifyCustomer: shouldNotifyCustomer,
          },
        },
      });

      if (errors) {
        return { data: null, error: errors.message ?? "Error creating fulfillment" };
      }

      if (data?.fulfillmentCreateV2?.fulfillment?.status === "SUCCESS") {
        logger.info(`Fulfillment created successfully for order ${orderId}`, {
          orderId,
          category: 'AUTOMATED'
        });
        await db.update(orderHolds).set({
          isResolved: true,
          resolvedAt: new Date(),
          resolvedNotes: `Order #${trackingInfo.orderNumber} fulfilled`,
        }).where(eq(orderHolds.orderId, orderId));
        return { data: "success", error: null };
      }
      return { data: null, error: "Error creating fulfillment" };
    }
    return { data: null, error: "No open fulfillment order found" };
  } catch (e) {
    console.error(e);
    return { data: null, error: "Error fulfilling order" };
  }
};
