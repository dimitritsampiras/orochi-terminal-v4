import "dotenv/config";
import { webhooks } from "./setup-webhooks";
import { db } from "@/lib/clients/db";
import { bulkFulfillOrders } from "@/lib/core/orders/bulk-fulfill-orders";
import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { generatePackingSlip } from "@/lib/core/pdf/generate-packing-slip";
import fs from "fs";
import { shippo } from "@/lib/clients/shippo";
import QRCode from 'qrcode'
import { generateMergedShipmentPdf } from "@/lib/core/pdf/generate-merged-shipment-pdf";
import { getAssemblyLine } from "@/lib/core/session/create-assembly-line";
import { pickingRequirementSchema } from "@/lib/core/session/create-picking-requirements";


async function main() {

  // count the amount of chosenCarrierName: "AsendiaUsa" 
  // const shipments = await db.query.shipments.findMany({
  //   where: {
  //     chosenCarrierName: "AsendiaUsa",
  //   },
  //   columns: {
  //     id: true,
  //   },
  // });
  // console.log(shipments.length);

  // const variants = await db.query.productVariants.findMany({
  //   where: {
  //     productId: "gid://shopify/Product/9127560413398",
  //   },
  //   columns: {
  //     id: true,
  //   },
  // });

  // console.log(variants.length);

  // const buffer = await QRCode.toBuffer('I am a pony!', {
  //   type: "png",
  //   errorCorrectionLevel: "M", // good balance for phone scanning on labels
  //   margin: 1,
  //   scale: 6, // ~ 200–300px, fine for 2–3 cm print
  // });

  // fs.writeFileSync('./qrcode.png', buffer);
  // return;


  // const { data: assemblyLine } = await getAssemblyLine(455);
  // if (!assemblyLine) return;

  // const pickingRequirements = await db.query.batches.findFirst({
  //   where: { id: 455 },
  //   columns: { pickingListJson: true },
  // });
  // if (!pickingRequirements) return;

  // const pickingList = pickingRequirementSchema.array().parse(pickingRequirements.pickingListJson);


  // const z = await generateMergedShipmentPdf(
  //   455,
  //   pickingList,
  //   assemblyLine.lineItems
  // )
  // console.log(z);

  const data = await shopify.request(orderQuery, {
    variables: { id: 'gid://shopify/Order/6420592885974' }
  })
  console.log(data.data?.node);
  return;


  // const { data: order } = await shopify.request(orderQuery, {
  //   variables: { id: 'gid://shopify/Order/6329060065494' }
  // })

  // if (!order?.node || order.node.__typename !== "Order") return;

  // const shipment = await db.query.shipments.findFirst({
  //   where: { orderId: order.node.id },
  // })
  // if (!shipment) return;
  // const shippoLabel = await shippo.transactions.get(shipment.shippoTransactionId || '');

  // if (!shippoLabel) return;

  // const test = await generatePackingSlip(order.node, shipment, {
  //   sessionId: '455',
  //   shippingLabelURL: shippoLabel.labelUrl || '',  
  // })

  // fs.writeFileSync('./test-qrcode.pdf', test.data || '');




}




main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
