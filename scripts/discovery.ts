import "dotenv/config";

import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import { generatePremadePickingList } from "@/lib/core/pdf/generate-premade-picking-list";
import fs from "fs/promises";
import { generatePackingSlip } from "@/lib/core/pdf/generate-packing-slip";
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { db } from "@/lib/clients/db";
import { retrieveShipmentDataFromOrder } from "@/lib/core/shipping/retrieve-shipments-from-order";
import { generateMergedShipmentPdf } from "@/lib/core/pdf/generate-merged-shipment-pdf";
import { getPremadeStockRequirements } from "@/lib/core/session/get-premade-stock-requirements";
import { createSortedAssemblyLine, getAssemblyLine } from "@/lib/core/session/create-assembly-line";
import { generateAssemblyList } from "@/lib/core/pdf/generate-assembly-list";

async function main() {


  // const session = await db.query.batches.findFirst({
  //   where: {
  //     id: 450,
  //   },
  // })

  // if (!session) {
  //   console.error("Session not found");
  //   return;
  // }

  // const { data: lineItems } = await getLineItemsByBatchId(session.id);

  // if (!lineItems) {
  //   console.error("Line items not found");
  //   return;
  // }

  // const products = await db.query.products.findMany({
  //   where: {
  //     productVariants: {

  //     },

  //   },
  //   with: {
  //     productVariants: {
  //       columns: {
  //         title: true,
  //         warehouseInventory: true
  //       }
  //     },
  //   },
  // });

  // products.forEach((product) => {
  //   console.log(product);

  // });


  const batch = await db.query.batches.findFirst({
    where: {
      id: 450,
    },
  });

  if (!batch) {
    console.error("Batch not found");
    return;
  }

  const { data } = await getLineItemsByBatchId(batch.id);
  if (!data || !data.lineItems) {
    console.error("Line items not found");
    return;
  }
  const { lineItems } = data;
  const { items: premadeStockItems } = getPremadeStockRequirements(lineItems);
  const assemblyResult = await createSortedAssemblyLine(batch.id, lineItems, premadeStockItems);

  if (assemblyResult.error || !assemblyResult.data) {
    console.error("Failed to create sorted assembly line");
    return;
  }
  const { data: assemblyList } = await generateAssemblyList(assemblyResult.data.assemblyLine, batch);

  if (!assemblyList) {
    console.error("Failed to generate assembly list");
    return;
  }

  await fs.writeFile("assembly-list.pdf", assemblyList);
  console.log("Assembly list generated successfully");

  return;
}


main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
