import { logger } from "@/lib/core/logger";
import { upsertOrderToDb } from "@/lib/core/orders/upsert-order-to-db";
import { buildResourceGid } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";


const orderWebhookSchema = z.union([
  z.object({
    order_edit: z.object({
      order_id: z.number(),
    }),
  }),
  z.object({
    admin_graphql_api_id: z.string(),
  }),
]);

export const POST = async (request: NextRequest) => {
  console.log("[order webhook] Received request");


  let rawBody;
  try {
    rawBody = await request.json();
  } catch (error) {
    logger.error("[order webhook] Error parsing request body", {
      category: "AUTOMATED",
    });
    return new NextResponse("Error parsing request body", { status: 400 });
  }

  const parsedBody = orderWebhookSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    logger.error("[order webhook] Invalid request body", {
      category: "AUTOMATED",
    });
    return new NextResponse("Invalid request body", { status: 400 });
  }

  // Extract admin_graphql_api_id from either payload type
  let adminGraphqlApiId: string;

  if ("order_edit" in parsedBody.data) {
    // Convert numeric order_id to GraphQL ID format
    adminGraphqlApiId = buildResourceGid("Order", parsedBody.data.order_edit.order_id);
  } else {
    adminGraphqlApiId = parsedBody.data.admin_graphql_api_id;
  }

  const { data, error } = await upsertOrderToDb(adminGraphqlApiId);

  if (error) {
    console.error(error);
    return new NextResponse("Error upserting order to db", { status: 500 });
  }

  return new NextResponse("OK");

}