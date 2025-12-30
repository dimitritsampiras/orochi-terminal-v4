import "dotenv/config";
import { db } from "@/lib/clients/db";
import dayjs from "dayjs";
import { lineItems, orders } from "@drizzle/schema";
import { eq, like } from "drizzle-orm";

async function main() {
  // There is no 'includes' or 'contains' function in drizzle-orm for Postgres;
  // instead, use the 'like' operator with wildcards for substring search:
  const tips = await db.select().from(lineItems).where(like(lineItems.name, "%Gift Card%"));
  for (const tip of tips) {
    console.log(tip.name);
    if (tip.name.includes("Gift Card")) {
      await db
        .update(lineItems)
        .set({
          requiresShipping: false,
        })
        .where(eq(lineItems.id, tip.id));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
