import "dotenv/config";
import { webhooks } from "./setup-webhooks";
import { db } from "@/lib/clients/db";


async function main() {

  // count the amount of chosenCarrierName: "AsendiaUsa" 
  const shipments = await db.query.shipments.findMany({
    where: {
      chosenCarrierName: "AsendiaUsa",
    },
    columns: {
      id: true,
    },
  });
  console.log(shipments.length);



}




main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
