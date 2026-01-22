
import "dotenv/config";
import { db } from "@/lib/clients/db";
import { orders, lineItems, productVariants } from "@drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

async function run() {
    console.log("Starting Debug...");

    try {
        console.log("1. Querying orders...");
        const resOrders = await db.select().from(orders).limit(1);
        console.log("Orders OK. Found:", resOrders.length);

        console.log("2. Querying lineItems...");
        const resLineItems = await db.select().from(lineItems).limit(1);
        console.log("LineItems OK. Found:", resLineItems.length);

        console.log("3. Querying productVariants...");
        const resVariants = await db.select().from(productVariants).limit(1);
        console.log("ProductVariants OK. Found:", resVariants.length);

        console.log("4. Joining orders + lineItems...");
        const resJoin1 = await db
            .select({ id: orders.id, li: lineItems.id })
            .from(orders)
            .innerJoin(lineItems, eq(orders.id, lineItems.orderId))
            .limit(1);
        console.log("Join 1 OK. Found:", resJoin1.length);

        console.log("5. Joining lineItems + productVariants...");
        const resJoin2 = await db
            .select({ li: lineItems.id, pv: productVariants.id })
            .from(lineItems)
            .innerJoin(productVariants, eq(lineItems.variantId, productVariants.id))
            .limit(1);
        console.log("Join 2 OK. Found:", resJoin2.length);


        const start = new Date();
        start.setDate(start.getDate() - 30);
        const end = new Date();

        console.log("6. Full Join with Date Filter...");
        const resFull = await db
            .select({ qty: lineItems.quantity, price: productVariants.price })
            .from(orders)
            .innerJoin(lineItems, eq(orders.id, lineItems.orderId))
            .innerJoin(productVariants, eq(lineItems.variantId, productVariants.id))
            .where(
                and(
                    gte(orders.createdAt, start),
                    lte(orders.createdAt, end)
                )
            )
            .limit(1);

        console.log("Full Join OK. Found:", resFull.length);

    } catch (e) {
        console.error("DEBUG FAILED:", e);
    }
    process.exit(0);
}

run();
