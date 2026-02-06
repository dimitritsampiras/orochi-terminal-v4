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

export const weeklyFinancialsQuery = `#graphql
  query WeeklyFinancials($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on Order {
        id
        name
        createdAt
        currencyCode
        originalTotalPriceSet {
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
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        currentSubtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalDiscountsSet {
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
        totalShippingPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        currentShippingPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalTaxSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        currentTotalTaxSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        lineItems(first: 250) {
          nodes {
            id
            quantity
            originalTotalSet {
              shopMoney {
                amount
              }
            }
            originalUnitPriceSet {
              shopMoney {
                amount
              }
            }
            discountedTotalSet {
              shopMoney {
                amount
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
        refunds {
          id
          createdAt
          totalRefundedSet {
            shopMoney {
              amount
            }
          }
          transactions(first: 10) {
            nodes {
              status
            }
          }
          refundLineItems(first: 50) {
            nodes {
              subtotalSet {
                shopMoney {
                  amount
                }
              }
              totalTaxSet {
                shopMoney {
                  amount
                }
              }
            }
          }
          refundShippingLines(first: 10) {
            nodes {
              subtotalAmountSet {
                shopMoney {
                  amount
                }
              }
              taxAmountSet {
                shopMoney {
                  amount
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Batch query for fetching multiple orders for shipping rate calculation
 * Uses nodes() to fetch up to 100 orders at once (Shopify limit)
 */
export const batchOrdersForShippingQuery = `#graphql
  query BatchOrdersForShipping($ids: [ID!]!) {
    nodes(ids: $ids) {
      __typename
      ... on Order {
        id
        name
        createdAt
        totalPriceSet {
          shopMoney {
            amount
          }
        }
        shippingAddress {
          address1
          address2
          city
          country
          countryCodeV2
          firstName
          lastName
          phone
          company
          provinceCode
          province
          zip
        }
        displayFulfillmentStatus
        lineItems(first: 25) {
          nodes {
            id
            title
            variantTitle
            quantity
            name
            originalTotalSet {
              shopMoney {
                amount
              }
            }
            unfulfilledQuantity
            requiresShipping
            nonFulfillableQuantity
            variant {
              id
              inventoryItem {
                measurement {
                  weight {
                    unit
                    value
                  }
                }
              }
            }
            product {
              id
              tracksInventory
              productType
            }
          }
        }
      }
    }
  }
`;
