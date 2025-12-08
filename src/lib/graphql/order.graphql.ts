export const orderQuery = `#graphql
  query Order($id: ID!){
    node(id: $id) {
      id
      __typename
      ... on Order {
        name
        createdAt
        updatedAt
        cancelledAt
        note
        totalPriceSet {
          shopMoney {
            amount
          }
        }
        risk {
          assessments {
            riskLevel
          }
        }
        localizedFields(first: 5) {
          nodes {
            key
            purpose
            value 
          }
        }
        customer {
          firstName
          lastName
          numberOfOrders
          email
          tags
        }
        app {
          name
        }
        discountCodes
        shippingLine {
          title
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
            image {
              url(transform: {maxHeight: 100, maxWidth: 100})
            }
            originalTotalSet {
              shopMoney {
                amount
              }
            }
            vendor
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
