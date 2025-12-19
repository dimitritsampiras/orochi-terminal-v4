export const productQuery = `#graphql
query Product($id: ID!) {
  product(id: $id) {
    id
    title
    vendor
    createdAt
    updatedAt
    status
    tracksInventory
    featuredMedia {
      preview {
        image {
          id
          url
        }
      }
    }
    variants(first: 25) {
      edges {
        cursor
      }
      nodes {
        id
        title
        price
        createdAt
        updatedAt
      }
    }
  }
}`;

export const productMediaQuery = `#graphql
  query ProductMediaQuery($query: String) {
    files(first: 7, query: $query) {
      edges {
        node {
          createdAt
          updatedAt
          alt
          ... on GenericFile {
            __typename
            id
            url
          }
          ... on MediaImage {
            __typename
            id
            alt
            image {
              id
              url(transform: {maxHeight: 750, maxWidth: 750})
            }
          }
          ... on Video {
            __typename
            id
          }
        }
      }
    }
  }
`;
