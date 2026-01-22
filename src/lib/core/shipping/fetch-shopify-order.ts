
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { logger } from "../logger";

type ShopifyOrder = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;

/**
 * Fetches a single order from Shopify by ID to get its shipping address.
 * Use this when the local DB is missing address data.
 */
export async function fetchShopifyOrder(orderId: string): Promise<ShopifyOrder | null> {
    try {
        const { data, errors } = await shopify.request(orderQuery, {
            variables: { id: orderId }
        });

        if (errors) {
            logger.error(`[Shopify] Error fetching order ${orderId}: ${JSON.stringify(errors)}`, {
                category: "SHIPPING",
                orderId
            });
            return null;
        }

        if (data?.node?.__typename === "Order") {
            return data.node as ShopifyOrder;
        }

        return null;
    } catch (error) {
        logger.error(`[Shopify] Exception fetching order ${orderId}`, {
            category: "SHIPPING",
            orderId,
            error
        });
        return null;
    }
}
