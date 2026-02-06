/**
 * Debug script to check for orders with many line items
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

import shopify from "@/lib/clients/shopify";

const query = `#graphql
  query GetOrderLineItemCounts($query: String!) {
    orders(first: 250, query: $query) {
      edges {
        node {
          id
          name
          lineItems(first: 1) {
            nodes {
              id
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

async function checkLineItemCounts() {
    const startISO = "2026-01-26T00:00:00.000Z";
    const endISO = "2026-02-01T23:59:59.999Z";

    const searchQuery = `created_at:>='${startISO}' created_at:<='${endISO}'`;

    console.log("Fetching orders...");
    const { data, errors } = await shopify.request(query, {
        variables: { query: searchQuery },
    });

    if (errors) {
        console.error("Errors:", errors);
        return;
    }

    const orders = data?.orders?.edges || [];
    console.log(`Found ${orders.length} orders`);

    // Now fetch full details for each order to count line items
    const detailQuery = `#graphql
      query GetOrderDetails($id: ID!) {
        order(id: $id) {
          id
          name
          lineItems(first: 250) {
            edges {
              node {
                id
                quantity
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      }
    `;

    let maxLineItems = 0;
    let maxOrder = "";

    for (const edge of orders) {
        const orderId = edge.node.id;
        const { data: orderData } = await shopify.request(detailQuery, {
            variables: { id: orderId },
        });

        const lineItemCount = orderData?.order?.lineItems?.edges?.length || 0;
        const hasMore = orderData?.order?.lineItems?.pageInfo?.hasNextPage || false;

        if (lineItemCount > maxLineItems) {
            maxLineItems = lineItemCount;
            maxOrder = orderData?.order?.name || orderId;
        }

        if (hasMore) {
            console.log(`⚠️  Order ${orderData?.order?.name} has MORE than ${lineItemCount} line items!`);
        }
    }

    console.log(`\nMax line items in a single order: ${maxLineItems} (Order: ${maxOrder})`);
}

checkLineItemCounts()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
