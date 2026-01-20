import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { logger } from "@/lib/core/logger";
import { productQuery } from "@/lib/graphql/product.graphql";
import { products, productVariants } from "@drizzle/schema";
import { eq, sql } from "drizzle-orm";
import z from "zod";

export async function POST(request: Request) {
  const productUpdateSchema = z.object({
    admin_graphql_api_id: z.string(),
  });

  const body = await request.json();

  const parsedBody = productUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    logger.error("[product update webhook] Invalid request body", {
      category: "AUTOMATED",
      metadata: JSON.stringify(body).slice(0, 5000),
    });
    return new Response("Invalid request body", { status: 400 });
  }

  const { admin_graphql_api_id } = parsedBody.data;

  const existingProduct = await db.query.products.findFirst({
    where: {
      id: admin_graphql_api_id,
    },
  });

  if (!existingProduct) {
    logger.warn(`[product update webhook] Product ${admin_graphql_api_id} doesn't exist`, {
      category: "AUTOMATED",
    });
    return new Response("Product doesn't exist", { status: 404 });
  }

  const { data, errors } = await shopify.request(productQuery, {
    variables: { id: admin_graphql_api_id },
  });

  if (errors || !data?.product) {
    logger.error("[product update webhook] Error fetching shopify product", {
      category: "AUTOMATED",
      metadata: JSON.stringify(errors).slice(0, 5000),
    });
    return new Response("Error fetching product", { status: 400 });
  }

  const product = data.product;

  if (product.variants.nodes.length >= 25) {
    logger.error("[product update webhook] Variant gql query limit reached at 25.", {
      category: "AUTOMATED",
      metadata: JSON.stringify({ productId: product.id, title: product.title }),
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        title: product.title,
        vendor: product.vendor,
        status: `${product.status}`,
        updatedAt: product.updatedAt,
      })
      .where(eq(products.id, admin_graphql_api_id));

    // Upsert variants: insert new ones or update existing ones
    if (product.variants.nodes.length > 0) {
      for (const variant of product.variants.nodes) {
        await tx
          .insert(productVariants)
          .values({
            id: variant.id,
            title: variant.title,
            price: variant.price,
            productId: product.id,
            createdAt: variant.createdAt,
            updatedAt: variant.updatedAt,
          })
          .onConflictDoUpdate({
            target: productVariants.id,
            set: {
              title: variant.title,
              price: variant.price,
              updatedAt: sql`now()`,
            },
          });
      }
    }
  });

  logger.info(`[product update webhook] Product ${product.title} updated`, {
    category: "AUTOMATED",
  });

  return new Response("OK");
}
