import "dotenv/config";
import { db } from "@/lib/clients/db";
import { orders, lineItems } from "@drizzle/schema";
import { eq, and, ilike } from "drizzle-orm";

async function main() {
    const targetItemName = "Run Club Box Crewneck - Black";
    console.log(`Querying order queue for items matching containing '${targetItemName}'...`);

    // Search for the specific item with wildcards (ignoring size suffixes)
    const result = await db
        .select({
            quantity: lineItems.quantity,
            orderId: orders.id,
            itemName: lineItems.name
        })
        .from(orders)
        .innerJoin(lineItems, eq(orders.id, lineItems.orderId))
        .where(
            and(
                eq(orders.queued, true),
                ilike(lineItems.name, `%${targetItemName}%`)
            )
        );

    const totalQuantity = result.reduce((acc, curr) => acc + curr.quantity, 0);

    console.log(`Found ${result.length} matching line items in queued orders.`);
    console.log(`Total Quantity: ${totalQuantity}`);

    // Group by name (which includes size)
    const breakdown: Record<string, number> = {};
    for (const item of result) {
        breakdown[item.itemName] = (breakdown[item.itemName] || 0) + item.quantity;
    }

    console.log("\n--- Breakdown by Variant Name ---");
    Object.entries(breakdown)
        .sort((a, b) => b[1] - a[1]) // Sort by quantity desc
        .forEach(([name, qty]) => {
            console.log(`${name}: ${qty}`);
        });
    console.log("---------------------------------");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
