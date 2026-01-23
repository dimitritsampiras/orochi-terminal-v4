import { logger } from "@/lib/core/logger";
import { upsertProductToDb } from "@/lib/core/orders/upsert-product-to-db";
import { buildResourceGid } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";


const productWebhookSchema = z.object({
  admin_graphql_api_id: z.string(),
});

export const POST = async (request: NextRequest) => {
  console.log("[product webhook] Received request");


  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
    logger.error("[product webhook] Error parsing request body", {
      category: "AUTOMATED",
    });
    return new NextResponse("Error parsing request body", { status: 400 });
  }

  const parsedBody = productWebhookSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    console.log('[product webhook] Invalid request body', parsedBody.error);
    return new NextResponse("Invalid request body", { status: 400 });
  }

  // Extract admin_graphql_api_id from either payload type
  const adminGraphqlApiId = parsedBody.data.admin_graphql_api_id;

  const { data, error } = await upsertProductToDb(adminGraphqlApiId);

  if (error) {
    console.error(error);
    return new NextResponse("Error upserting product to db", { status: 500 });
  }

  return new NextResponse("OK");

}