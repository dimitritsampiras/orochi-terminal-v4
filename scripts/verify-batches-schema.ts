
import "dotenv/config";
import { db } from "@/lib/clients/db";
import { batches } from "@drizzle/schema";
import { sql } from "drizzle-orm";

async function run() {
    console.log("Verifying batches schema...");
    try {
        // Try to select settledAt specifically
        const result = await db.select({
            id: batches.id,
            settledAt: batches.settledAt
        }).from(batches).limit(1);

        console.log("Query successful!");
        console.log("Result:", result);
    } catch (e) {
        console.error("Query FAILED:", e);
        process.exit(1);
    }
    process.exit(0);
}

run();
