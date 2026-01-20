import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { logger } from "@/lib/core/logger";
import { productQuery } from "@/lib/graphql/product.graphql";
import { ProductQuery } from "@/lib/types/admin.generated";
import { products, productVariants } from "@drizzle/schema";
import z from "zod";

export async function POST(request: Request) {
  const productCreateSchema = z.object({
    admin_graphql_api_id: z.string(),
  });

  const body = await request.json();

  const parsedBody = productCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    logger.error("[product create webhook] Invalid request body", {
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

  if (existingProduct) {
    logger.warn(`[product create webhook] Product ${admin_graphql_api_id} already exists`, {
      category: "AUTOMATED",
      metadata: JSON.stringify(existingProduct).slice(0, 5000),
    });
    return new Response("Product already exists", { status: 200 });
  }

  const { data, errors } = await shopify.request(productQuery, {
    variables: { id: admin_graphql_api_id },
  });

  if (errors || !data?.product) {
    logger.error("[product create webhook] Error fetching shopify product", {
      category: "AUTOMATED",
      metadata: JSON.stringify(errors).slice(0, 5000),
    });
    return new Response("Error fetching product", { status: 400 });
  }

  const product = data.product;

  if (product.variants.nodes.length >= 25) {
    logger.error("[product create webhook] Variant gql query limit reached at 25.", {
      category: "AUTOMATED",
      metadata: JSON.stringify({ productId: product.id, title: product.title }),
    });
  }

  await db.transaction(async (tx) => {
    await tx.insert(products).values({
      id: product.id,
      title: product.title,
      vendor: product.vendor,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });

    if (product.variants.nodes.length > 0) {
      await tx.insert(productVariants).values(
        product.variants.nodes.map<typeof productVariants.$inferInsert>((variant) => ({
          id: variant.id,
          title: variant.title,
          price: variant.price,
          productId: product.id,
          createdAt: variant.createdAt,
          updatedAt: variant.updatedAt,
        }))
      );
    }
  });

  logger.info(`[product create webhook] Product ${product.title} created`, {
    category: "AUTOMATED",
  });

  return new Response("OK");
}

