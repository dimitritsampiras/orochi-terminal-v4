import { AssemblyItemController } from "@/components/controllers/assembly-item-controller";
import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { getLineItemById } from "@/lib/core/session/get-session-line-items";

import { orderQuery } from "@/lib/graphql/order.graphql";
import { productMediaQuery } from "@/lib/graphql/product.graphql";
import { MediaImage } from "@/lib/types/misc";
import { buildResourceGid } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function AssemblyItemPage({ params }: { params: Promise<{ item_id: string }> }) {
  await authorizePageUser("assembly");
  const { item_id } = await params;

  const lineItemId = buildResourceGid("LineItem", item_id);
  const activeSession = await db.query.batches.findFirst({
    where: { active: true, },
  });
  const { data: item, error } = await getLineItemById(lineItemId, activeSession?.id);

  if (!item) {
    return notFound();
  }

  const [mediaRes, orderRes, inventoryTransactions] = await Promise.all([
    shopify.request(productMediaQuery, {
      variables: { query: `product_id:'${item?.productId?.split("/").pop()}'` },
    }),
    shopify.request(orderQuery, {
      variables: { id: item.orderId },
    }),
    db.query.inventoryTransactions.findMany({
      where: { lineItemId },
      with: {
        log: true,
      }
    }),
  ]);
  const { data: media } = mediaRes;
  const { data: orderData } = orderRes;

  let order = orderData?.node?.__typename === "Order" ? orderData.node : undefined;

  return (
    <AssemblyItemController
      item={item}
      media={media?.files.nodes.map((node) => node as MediaImage) || []}
      order={order}
      inventoryTransactions={inventoryTransactions}
    />
  );
}
