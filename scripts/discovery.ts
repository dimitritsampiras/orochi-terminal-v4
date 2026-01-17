import "dotenv/config";

import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import { generatePremadePickingList } from "@/lib/core/pdf/generate-premade-picking-list";
import fs from "fs/promises";

async function main() {
  // await bulkFulfillOrders();
  // const session = await db
  const { data, error } = await getLineItemsByBatchId(448);

  if (!data) {
    console.log("prematurn return", error);

    return;
  }
  const { data: buffer, error: generateError } = await generatePremadePickingList(data.lineItems, data.batch);

  if (generateError) {
    console.log("generate premade picking list error", generateError);

    return;
  }

  if (buffer) {
    await fs.writeFile("./test-premade-list.pdf", buffer);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
