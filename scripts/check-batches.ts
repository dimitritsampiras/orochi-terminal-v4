import "dotenv/config";
import { db } from "@/lib/clients/db";
import { batches } from "@drizzle/schema";
import { desc, isNotNull } from "drizzle-orm";

async function checkBatches() {
    const settledBatches = await db
        .select()
        .from(batches)
        .where(isNotNull(batches.settledAt))
        .orderBy(desc(batches.settledAt))
        .limit(5);

    console.log("Found", settledBatches.length, "settled batches.");
    settledBatches.forEach(b => {
        console.log(`- Batch ${b.id}: Settled at ${b.settledAt}`);
    });

    const activeBatches = await db.select().from(batches).where(isNotNull(batches.startedAt)).limit(5);
    console.log("Found", activeBatches.length, "active batches.");
    activeBatches.forEach(b => {
        console.log(`- Batch ${b.id}: Active (Started at ${b.startedAt})`);
    });
}

checkBatches().catch(console.error).finally(() => process.exit(0));
