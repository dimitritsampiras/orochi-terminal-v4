import { AssemblyItemController } from "@/components/controllers/assembly-item-controller";
import { BackButton } from "@/components/nav/back-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { getAssemblyLine, getLineItemById } from "@/lib/core/session/create-assembly-line";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { productMediaQuery } from "@/lib/graphql/product.graphql";
import { ProductMediaQueryQuery } from "@/lib/types/admin.generated";
import { MediaImage } from "@/lib/types/misc";
import { buildResourceGid } from "@/lib/utils";
import { Icon } from "@iconify/react";
import { notFound, redirect } from "next/navigation";

export default async function AssemblyItemPage({ params }: { params: Promise<{ item_id: string; batch_id: string }> }) {
  const { item_id } = await params;

  const lineItemId = buildResourceGid("LineItem", item_id);
  const { data: item, error } = await getLineItemById(lineItemId);

  if (!item) {
    return notFound();
  }

  const [mediaRes, orderRes] = await Promise.all([
    shopify.request(productMediaQuery, {
      variables: { query: `product_id:'${item?.productId?.split("/").pop()}'` },
    }),
    shopify.request(orderQuery, {
      variables: { id: item.orderId },
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
    />
  );
}
