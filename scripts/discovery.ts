import "dotenv/config";
import { webhooks } from "./setup-webhooks";
import z from "zod";
import { helloWorldTask } from "@/trigger/example";

// import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
// import { generatePremadePickingList } from "@/lib/core/pdf/generate-premade-picking-list";
// import fs from "fs/promises";
// import { generatePackingSlip } from "@/lib/core/pdf/generate-packing-slip";
// import shopify from "@/lib/clients/shopify";
// import { orderQuery } from "@/lib/graphql/order.graphql";
// import { db } from "@/lib/clients/db";
// import { retrieveShipmentDataFromOrder } from "@/lib/core/shipping/retrieve-shipments-from-order";
// import { generateMergedShipmentPdf } from "@/lib/core/pdf/generate-merged-shipment-pdf";
// import { getPremadeStockRequirements } from "@/lib/core/session/get-premade-stock-requirements";
// import { createSortedAssemblyLine, getAssemblyLine } from "@/lib/core/session/create-assembly-line";
// import { generateAssemblyList } from "@/lib/core/pdf/generate-assembly-list";
// import { adjustInventory } from "@/lib/core/inventory/adjust-inventory";
// import { eq } from "drizzle-orm";
// import { inventoryTransactions } from "@drizzle/schema";

async function main() {

  // await webhooks();

  // const orderWebhookSchema = z.union([
  //   z.object({
  //     order_edit: z.object({
  //       order_id: z.number(),
  //     }),
  //   }),
  //   z.object({
  //     admin_graphql_api_id: z.string(),
  //   }),
  // ]);

  // console.log(orderWebhookSchema.safeParse({
  //   admin_graphql_api_id: "gid://shopify/Order/1234567890",
  // }));
  // ;

  await helloWorldTask.trigger({ message: "Hello, world!" });

}




main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
