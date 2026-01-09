import { FulfillmentStatusBadge } from "@/components/badges/fulfillment-status-badge";
import { OrderCompletionStatusBadge } from "@/components/badges/order-completion-status-badge";
import { IdCopyBadge } from "@/components/badges/id-copy-badge";
import { QueueStatusBadge } from "@/components/badges/queue-status-badge";
import { CustomerCard } from "@/components/cards/customer-card";
import { OrderLineItems } from "@/components/cards/order-line-items";
import { OrderLogs } from "@/components/cards/order-logs";
import { OrderNotesCard } from "@/components/cards/order-notes";
import { ShippingInfo } from "@/components/cards/shipping-info";
import { CountryFlag } from "@/components/country-flag";
import { QueueOrderForm } from "@/components/forms/order-forms/queue-order-form";
import { SetFulfillmentPriorityForm } from "@/components/forms/order-forms/set-fulfillment-priority-form";
import { SetShippingPriorityForm } from "@/components/forms/order-forms/set-shipping-priority-form";
import { Badge } from "@/components/ui/badge";

import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { createClient } from "@/lib/clients/supabase-server";
import { retrieveShipmentDataFromOrder } from "@/lib/core/shipping/retrieve-shipments-from-order";

import { orderQuery } from "@/lib/graphql/order.graphql";
import { buildResourceGid, isOrderComplete } from "@/lib/utils";
import { Icon } from "@iconify/react";
import dayjs from "dayjs";
import Link from "next/link";
import { BackButton } from "@/components/nav/back-button";
import { OrderNavigation } from "@/components/nav/order-navigation";

export default async function OrderPage({ params }: { params: Promise<{ order_id: string }> }) {
  const { order_id } = await params;

  const gid = buildResourceGid("Order", order_id);

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const [shopifyOrder, databaseOrder, logs, currentUserProfile] = await Promise.all([
    shopify.request(orderQuery, {
      variables: {
        id: gid,
      },
    }),
    db.query.orders.findFirst({
      where: { id: gid },
      with: {
        lineItems: true,
        batches: {
          columns: {
            id: true,
          },
        },
        shipments: true,
        orderNotes: {
          with: {
            profile: {
              columns: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    }),
    db.query.logs.findMany({
      where: { orderId: gid },
      orderBy: { createdAt: "desc" },
    }),
    authUser
      ? db.query.profiles.findFirst({
          where: { id: authUser.id },
          columns: { username: true },
        })
      : null,
  ]);

  if (shopifyOrder.data?.node?.__typename !== "Order" || !databaseOrder) {
    throw Error("Something went wrong fetching the order");
  }

  const order = shopifyOrder.data.node;

  const shipmentData = await retrieveShipmentDataFromOrder(databaseOrder.shipments);

  console.log(shipmentData);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/orders" />
          <h1 className="page-title">Order {order.name}</h1>
        </div>
        <OrderNavigation orderId={order.id} />
      </div>
      <div className="flex items-center gap-2 mt-3">
        <IdCopyBadge id={order.id} />
        <div className="flex items-center gap-2 text-xs">
          <Icon icon="ph:calendar-blank" />
          Created at {dayjs(order.createdAt).format("MMMM DD, YYYY")}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4">
        {databaseOrder.batches.length > 0 ? (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 h-9 text-sm font-medium rounded-m border-blue-100">
            {databaseOrder.batches.length > 1 ? "In sessions:" : "In session:"}
            {databaseOrder.batches.map((batch, index) => (
              <div key={batch.id}>
                <Link key={batch.id} href={`/sessions/${batch.id}`} className="font-semibold hover:opacity-80">
                  {batch.id}
                </Link>
                {index < databaseOrder.batches.length - 1 && <span>,</span>}
              </div>
            ))}
          </div>
        ) : (
          <Badge variant="outline">NEW</Badge>
        )}
        {order.shippingAddress && (
          <CountryFlag
            countryCode={order.shippingAddress.countryCodeV2 || ""}
            countryName={order.shippingAddress.country || ""}
          />
        )}
      </div>

      <div className="my-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <OrderCompletionStatusBadge status={isOrderComplete(databaseOrder.lineItems)} />
          <FulfillmentStatusBadge status={order.displayFulfillmentStatus} />
          <QueueStatusBadge queued={databaseOrder.queued} />
          {order.cancelledAt && (
            <Badge variant="destructive">cancelled at {dayjs(order.cancelledAt).format("MMM D, YYYY")}</Badge>
          )}
          {order.displayFinancialStatus && order.displayFinancialStatus === "REFUNDED" && (
            <Badge variant="destructive">cancelled at {dayjs(order.cancelledAt).format("MMM D, YYYY")}</Badge>
          )}
        </div>
        <div>
          <QueueOrderForm orderId={order.id} currentQueueStatus={databaseOrder.queued} />
        </div>
      </div>

      <div className="mb-24 mt-2 grid-cols-[2fr_1fr] gap-4 md:grid">
        <div className="flex flex-col gap-4">
          <OrderLineItems
            orderId={order.id}
            shopifyLineItems={order.lineItems.nodes}
            databaseLineItems={databaseOrder.lineItems}
          />
          <ShippingInfo orderId={order.id} orderShipmentData={shipmentData} lineItems={order.lineItems.nodes} />
          <OrderLogs logs={logs || []} className="sm:block hidden" />
        </div>
        <div className="flex flex-col gap-4 sm:mt-0 mt-4">
          <div className="flex items-center gap-2 w-full">
            <SetFulfillmentPriorityForm
              currentPriority={databaseOrder.fulfillmentPriority}
              orderId={order.id}
              className="flex-1"
            />
            <SetShippingPriorityForm
              currentPriority={databaseOrder.shippingPriority}
              orderId={order.id}
              className="flex-1"
            />
          </div>
          {order.customer && (
            <CustomerCard customer={order.customer} shippingAddress={order.shippingAddress ?? undefined} />
          )}
          <OrderNotesCard
            orderId={order.id}
            shopifyNote={order.note}
            databaseNotes={databaseOrder.orderNotes}
            currentUsername={currentUserProfile?.username || ""}
          />
          <OrderLogs logs={logs || []} className="sm:hidden block" />
        </div>
      </div>
    </div>
  );
}
