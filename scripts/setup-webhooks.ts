import shopify from "@/lib/clients/shopify";
import { createWebhookMutation, deleteWebhookMutation, webhooksQuery } from "@/lib/graphql/webhook.graphql";
import type { WebhookSubscriptionFormat, WebhookSubscriptionTopic } from "@/lib/types/admin.types";
import { InputMaybe } from "@shopify/admin-api-client";





export const webhooks = async () => {
  const { data, errors } = await shopify.request(webhooksQuery);

  if (errors || !data?.webhookSubscriptions.edges) {
    console.error(errors);
    return;
  }

  for (const edge of data.webhookSubscriptions.edges) {
    const { data: deleted, errors: deletedErrors } = await shopify.request(deleteWebhookMutation, {
      variables: {
        id: edge.node.id,
      }
    });
    console.log('deleted', edge.node.topic, deleted?.webhookSubscriptionDelete, deletedErrors);
  }

  console.dir(data?.webhookSubscriptions.edges, { depth: null });


  const baseUrl = 'https://orochi-terminal-v4.vercel.app';


  const topicToRoute: { topics: `${WebhookSubscriptionTopic}`[], route: string }[] = [{
    topics: ["ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_EDITED", "ORDERS_CANCELLED", "ORDERS_FULFILLED"],
    route: `${baseUrl}/api/webhook/shopify/order`
  }, {
    topics: ["PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE"],
    route: `${baseUrl}/api/webhook/shopify/product`
  }]


  for (const { topics, route } of topicToRoute) {
    for (const topic of topics) {
      console.log(`[setup-webhooks] Creating webhook for topic ${topic}`);
      const { data: created, errors: createdErrors } = await shopify.request(createWebhookMutation, {
        variables: {
          topic: topic as WebhookSubscriptionTopic,
          webhookSubscription: {
            uri: route,
            format: "JSON" as WebhookSubscriptionFormat,
          }
        }
      });

      console.log(created?.webhookSubscriptionCreate, createdErrors);
    }
  }
};
