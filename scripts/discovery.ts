import "dotenv/config";
import { webhooks } from "./setup-webhooks";

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

  await webhooks();
  // const assemblyLine = await getAssemblyLine(450);

  // if (assemblyLine.error || !assemblyLine.data) {
  //   console.error(assemblyLine.error);
  //   return;
  // }


  // const inventoryTransactionIdsToRevert = [104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114]
  // const transactionsToRevert = await db.query.inventoryTransactions.findMany({
  //   where: {
  //     id: { in: inventoryTransactionIdsToRevert },
  //   },
  // });

  // for (const transaction of transactionsToRevert) {
  //   if (transaction.productVariantId) {
  //     const productVariant = await db.query.productVariants.findFirst({
  //       where: {
  //         id: transaction.productVariantId,
  //       },
  //     })
  //     if (productVariant) {
  //       const changeAmount = transaction.changeAmount < 0 ? Math.abs(transaction.changeAmount) : -transaction.changeAmount;
  //       console.log('reverting inventory for item', productVariant.title, changeAmount, transaction.id);
  //       await adjustInventory(
  //         { type: "product", variantId: productVariant.id },
  //         transaction.changeAmount,
  //         transaction.reason,
  //         {
  //           batchId: 450,
  //         }
  //       );
  //       await db.delete(inventoryTransactions).where(eq(inventoryTransactions.id, transaction.id));
  //     }
  //   }
  // }

  // for (const item of assemblyLine.data.lineItems) {
  //   if (item.expectedFulfillment === 'stock' && item.productVariant) {
  //     console.log('decrementing inventory for item', item.name);

  //     await adjustInventory(
  //       { type: "product", variantId: item.productVariant.id },
  //       -item.quantity,
  //       "assembly_usage",
  //       {
  //         batchId: 450,
  //         lineItemId: item.id,
  //       }
  //     );
  //   }
  // }


}




main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
