import "dotenv/config";
import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { OrderQuery } from "@/lib/types/admin.generated";
import { buildResourceGid } from "@/lib/utils";
import { generatePackingSlip } from "@/lib/core/pdf/generate-packing-slip";
import fs from "fs";
import { getLineItemsByBatchId } from "@/lib/core/session/create-assembly-line";

async function main() {
  // const orderNumber = "6342766035158";
  // const orderId = buildResourceGid("Order", orderNumber);

  // // Fetch order from Shopify
  // const { data: orderData, errors } = await shopify.request(orderQuery, {
  //   variables: { id: orderId },
  // });

  // if (errors) {
  //   console.error("Shopify errors:", errors);
  //   return;
  // }

  // if (!orderData?.node || orderData.node.__typename !== "Order") {
  //   console.error("Order not found or invalid type");
  //   return;
  // }

  // const order = orderData.node as Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;
  // console.log("✅ Fetched order:", order.name);

  // // Fetch shipment from database
  // const shipment = await db.query.shipments.findFirst({
  //   where: { orderId },
  // });

  // if (!shipment) {
  //   console.error("No shipment found for order:", orderId);
  //   return;
  // }

  // console.log("✅ Found shipment:", shipment.id);

  // // Generate packing slip
  // const { data: pdfBuffer, error } = await generatePackingSlip(order, shipment, {
  //   shippingLabelURL:
  //     "https://deliver.goshippo.com/47b6682a5caa47f3ab8cd82e124430b4.png?Expires=1797766747&Signature=RaQIzZ~LcMACYY~5Xwd1WlB261jCL-hAVAQLt0ZcIYvJyI1HwvsMuszDxqlZEpy2vD~NfNpjDminZU2zV8hMXv1HeZs4VKbnMnUDJ32DXFoHRW1Bdq3Wh44H4Cqtkj5us2Tz7212f8xP2r0IxoOdbkNbFUa0jKdM1ZWPGaEeM0axE-tEWIbd6gIPFbj8Cf7fIowHyMgiCvqcMT1~rDkWLu1V98QNgWSKuzf3OOzyuE6hVxeK9e86t~HPNtRCcHL78SnFNvmQSFSnzZ6Tog37huHDna4lNcS~7X1vUyEhRhEZ9cMtGOUvuTy3LhcjfbI5JQzQBQBanlK16AuUcXr0pA__&Key-Pair-Id=APKAJRICFXQ2S4YUQRSQ",
  // });

  // if (error || !pdfBuffer) {
  //   console.error("❌ Error generating packing slip:", error);
  //   return;
  // }

  // fs.writeFileSync("./scripts/test-packing-slip-2.pdf", pdfBuffer);
  // console.log("✅ Packing slip saved to ./scripts/test-packing-slip-old.pdf");

  const assemblyLine = await getLineItemsByBatchId(434);
  console.log(assemblyLine);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
