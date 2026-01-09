export const fulfillmentOrdersQuery = `#graphql
  query FulfillmentOrders($id: ID!) {
    node(id: $id) {
      id
      __typename
      ... on Order {
        name
        createdAt
        updatedAt
        cancelledAt
        fulfillmentOrders(first: 25) {
          nodes {
            assignedLocation {
              name
              address1
            }
            channelId
            createdAt
            destination {
              address1
              countryCode
            }
            fulfillAt
            id
            status
            orderId
            requestStatus
            lineItems(first: 25) {
              nodes {
                id
                productTitle
              }
            }
          }
        }
      }
    }
  }
`;

export const createFulfillmentMutation = `#graphql
  mutation CreateFulfillment($fulfillment: FulfillmentV2Input!) {
    fulfillmentCreateV2(fulfillment: $fulfillment) {
      fulfillment {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;
