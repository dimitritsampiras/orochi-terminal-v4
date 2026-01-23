import "dotenv/config";
import { webhooks } from "./setup-webhooks";


async function main() {

  await webhooks()

}




main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
