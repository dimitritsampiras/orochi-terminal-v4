import "dotenv/config";
import { webhooks } from "./setup-webhooks";
import { db } from "@/lib/clients/db";


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

  const variants = await db.query.productVariants.findMany({
    where: {
      productId: "gid://shopify/Product/9127560413398",
    },
    columns: {
      id: true,
    },
  });

  console.log(variants.length);




}




main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
