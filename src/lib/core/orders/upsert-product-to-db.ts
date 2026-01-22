import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { productQuery } from "@/lib/graphql/product.graphql";
import { ProductQuery } from "@/lib/types/admin.generated";
import { DataResponse } from "@/lib/types/misc";
import { products, productVariants } from "@drizzle/schema";
import { logger } from "../logger";
import { eq, sql } from "drizzle-orm";

type ShopifyProduct = NonNullable<ProductQuery["product"]>;

export const upsertProductToDb = async (adminGraphqlApiId: string): Promise<DataResponse<"success">> => {
  const { data, errors } = await shopify.request(productQuery, {
    variables: { id: adminGraphqlApiId },
  });

  if (errors || !data?.product) {
    return { data: null, error: "Error fetching shopify product" };
  }

  const product = data.product;

  if (product.variants.nodes.length >= 25) {
    return { data: null, error: "Variant gql query limit reached at 25." };
  }

  const existingProduct = await db.query.products.findFirst({
    where: { id: adminGraphqlApiId },
  });

  if (!existingProduct) {
    return createProduct(product);
  }

  return updateProduct(existingProduct, product);
};

const createProduct = async (shopifyProduct: ShopifyProduct): Promise<DataResponse<"success">> => {


  try {
    await db.transaction(async (tx) => {
      await tx.insert(products).values({
        id: shopifyProduct.id,
        title: shopifyProduct.title,
        vendor: shopifyProduct.vendor,
        status: shopifyProduct.status,
        createdAt: shopifyProduct.createdAt,
        updatedAt: shopifyProduct.updatedAt,
      });

      if (shopifyProduct.variants.nodes.length > 0) {
        await tx.insert(productVariants).values(
          shopifyProduct.variants.nodes.map<typeof productVariants.$inferInsert>((variant) => ({
            id: variant.id,
            title: variant.title,
            price: variant.price,
            productId: shopifyProduct.id,
            createdAt: variant.createdAt,
            updatedAt: variant.updatedAt,
          }))
        );
      }
    });
  } catch (error) {
    logger.error("[upsertProductToDb] Error creating product in db", {
      category: "AUTOMATED",
    });
    return { data: null, error: "Error creating product in db" };
  }

  return { data: "success", error: null };
};

const updateProduct = async (
  existingProduct: typeof products.$inferSelect,
  shopifyProduct: ShopifyProduct
): Promise<DataResponse<"success">> => {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          title: shopifyProduct.title,
          vendor: shopifyProduct.vendor,
          status: shopifyProduct.status,
          updatedAt: shopifyProduct.updatedAt,
        })
        .where(eq(products.id, existingProduct.id));

      if (shopifyProduct.variants.nodes.length > 0) {
        await tx
          .insert(productVariants)
          .values(
            shopifyProduct.variants.nodes.map<typeof productVariants.$inferInsert>((variant) => ({
              id: variant.id,
              title: variant.title,
              price: variant.price,
              productId: shopifyProduct.id,
              createdAt: variant.createdAt,
              updatedAt: variant.updatedAt,
            }))
          )
          .onConflictDoUpdate({
            target: productVariants.id,
            set: {
              title: sql.raw(`excluded.${productVariants.title.name}`),
              price: sql.raw(`excluded.${productVariants.price.name}`),
              updatedAt: sql`now()`,
            },
          });
      }
    });
  } catch (error) {
    logger.error("[upsertProductToDb] Error updating product in db", {
      category: "AUTOMATED",
    });
    return { data: null, error: "Error updating product in db" };
  }

  return { data: "success", error: null };
};