import shopify from "@/lib/clients/shopify";

import { orderQuery } from "@/lib/graphql/order.graphql";
import { buildResourceGid } from "@/lib/utils";

export default async function OrderPage({ params }: { params: Promise<{ order_id: string }> }) {
  const { order_id } = await params;

  const shopifyOrder = await shopify.request(orderQuery, {
    variables: {
      id: buildResourceGid("Order", order_id),
    },
  });

  console.log("shopifyOrder", shopifyOrder);

  return (
    <div>
      <h1 className="page-title">Order {order_id}</h1>
      <div className="page-subtitle">Manage customer order</div>
    </div>
  );
}
