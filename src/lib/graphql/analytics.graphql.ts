export const batchFinancialsQuery = `#graphql
  query BatchFinancials($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        name
        currencyCode
        currentTotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalRefundedSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;
