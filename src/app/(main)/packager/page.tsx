import { FulfillmentStatusBadge } from "@/components/badges/fulfillment-status-badge";
import { OrderCompletionStatusBadge } from "@/components/badges/order-completion-status-badge";
import { PackagerLineItemCard } from "@/components/cards/packager-line-item-card";
import { Search } from "@/components/inputs/search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { isOrderComplete } from "@/lib/utils";
import { Icon } from "@iconify/react";
import dayjs from "dayjs";

export default async function PackagerPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = params.q;

  const fetchOrder = async (query: string) => {
    const orderNumber = query.includes("#") ? query : `#${query}`;
    const order = await db.query.orders.findFirst({
      where: {
        name: orderNumber,
      },
      with: {
        lineItems: true,
        orderNotes: true,
      },
    });
    if (!order) {
      return null;
    }
    const { data: shopifyOrder } = await shopify.request(orderQuery, {
      variables: {
        id: order.id,
      },
    });

    if (!shopifyOrder || shopifyOrder.node?.__typename !== "Order") {
      return null;
    }

    const fetchedOrder = { order, shopifyOrder };
    return fetchedOrder;
  };

  type FetchedOrderData = NonNullable<Awaited<ReturnType<typeof fetchOrder>>>;
  let order: FetchedOrderData["order"] | null = null;
  let shopifyOrder: FetchedOrderData["shopifyOrder"] | null = null;

  if (q) {
    const data = await fetchOrder(q);
    if (data) {
      order = data.order;
      shopifyOrder = data.shopifyOrder;
    }
  }

  return (
    <div>
      <h1 className="page-title mb-4">Packager</h1>
      <Search placeholder="Search for an order" />
      {order && shopifyOrder && shopifyOrder.node?.__typename === "Order" && (
        <div className="mt-8 w-full flex flex-col items-center">
          <div className="flex items-center w-full max-w-lg  justify-between mb-4">
            <div>
              <h2 className="font-medium">Order {order.name}</h2>
              <p className="text-sm text-muted-foreground">
                Created at: {dayjs(order.createdAt).format("MMMM DD, YYYY")}
              </p>
            </div>
            <div className="gap-2 flex items-center">
              <OrderCompletionStatusBadge status={isOrderComplete(order.lineItems)} />
              <FulfillmentStatusBadge status={order.displayFulfillmentStatus} />
            </div>
          </div>

          {order.orderNotes.length > 0 && (
            <Alert className="max-w-lg bg-transparent! mt-4 mb-8">
              <Icon icon="ph:note" className="size-4" />
              <AlertTitle>Order Notes</AlertTitle>
              <AlertDescription>
                {order.orderNotes.map((note) => (
                  <div key={note.id} className="text-sm my-2">
                    <span className="text-zinc-400"> {dayjs(note.createdAt).format("MMM D, YYYY h:mm A")}</span>
                    <p className="text-zinc-600">{note.note}</p>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col items-center gap-4 max-w-lg">
            {shopifyOrder.node.lineItems.nodes
              .filter((item) => item.requiresShipping)
              .map((item) => {
                const dbItem = order.lineItems.find((lineItem) => lineItem.id === item.id);
                if (!dbItem) {
                  return null;
                }

                return (
                  <PackagerLineItemCard
                    key={item.id}
                    orderId={order.id}
                    shopifyItem={item}
                    dbItem={dbItem}
                  />
                );
              })}
          </div>
        </div>
      )}
      {q && !order && !shopifyOrder && (
        <Alert className="mt-4">
          <Icon icon="ph:warning" className="size-4" />
          <AlertTitle>Order not found</AlertTitle>
          <AlertDescription>Couldn't find an order with order number "{q}".</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
