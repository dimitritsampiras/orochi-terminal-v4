/**
 * Diagnostic script to analyze expected ship date calculation for a specific order
 * Usage: npx tsx scripts/debug-ship-date.ts <orderId>
 */

import "dotenv/config";
import { db } from "../src/lib/clients/db";
import { sql } from "drizzle-orm";
import dayjs from "dayjs";

async function debugShipDate(orderId: string) {
    console.log("=".repeat(80));
    console.log(`EXPECTED SHIP DATE CALCULATION DEBUG FOR ORDER: ${orderId}`);
    console.log("=".repeat(80));
    console.log();

    // 1. Get the order details
    const orderResult = await db.execute<{
        id: string;
        name: string;
        created_at: Date;
        queued: boolean;
        fulfillment_priority: string;
    }>(sql`
    SELECT id, name, created_at, queued, fulfillment_priority
    FROM orders 
    WHERE id = ${orderId}
  `);

    const order = orderResult[0];

    if (!order) {
        console.log(`❌ Order ${orderId} not found in database`);
        return;
    }

    // Get line item count
    const lineItemResult = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count FROM line_items WHERE order_id = ${orderId}
  `);
    const lineItemCount = lineItemResult[0]?.count || "0";

    console.log("📦 ORDER DETAILS:");
    console.log(`   - Order ID: ${order.id}`);
    console.log(`   - Order Name: ${order.name}`);
    console.log(`   - Created At: ${order.created_at}`);
    console.log(`   - Queued: ${order.queued}`);
    console.log(`   - Fulfillment Priority: ${order.fulfillment_priority}`);
    console.log(`   - Line Items: ${lineItemCount}`);
    console.log();

    // 2. Get queue position
    const queuedAheadResult = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count 
    FROM orders 
    WHERE queued = true AND created_at < ${order.created_at}
  `);
    const queuedOrdersAhead = parseInt(queuedAheadResult[0]?.count || "0");

    const totalQueuedResult = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*) as count FROM orders WHERE queued = true
  `);
    const totalQueuedOrders = parseInt(totalQueuedResult[0]?.count || "0");

    console.log("📊 QUEUE POSITION:");
    console.log(`   - Orders ahead in queue: ${queuedOrdersAhead}`);
    console.log(`   - Total queued orders: ${totalQueuedOrders}`);
    console.log(`   - Position: ${queuedOrdersAhead + 1} of ${totalQueuedOrders}`);
    console.log();

    // 3. Get batches from last 21 days
    const twentyOneDaysAgo = dayjs().subtract(21, "day").toISOString();

    const recentBatches = await db.execute<{ id: number; created_at: Date }>(sql`
    SELECT id, created_at 
    FROM batches 
    WHERE created_at >= ${twentyOneDaysAgo}::timestamptz
    ORDER BY created_at DESC
  `);

    console.log("📅 BATCHES IN LAST 21 DAYS:");
    console.log(`   - Total batches: ${recentBatches.length}`);

    // List each batch
    if (recentBatches.length > 0) {
        console.log("   📋 Batch Details:");
        for (const batch of recentBatches.slice(0, 15)) {
            const date = batch.created_at?.toISOString().split("T")[0] || "unknown";
            const dayOfWeek = batch.created_at
                ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][batch.created_at.getDay()]
                : "?";
            console.log(`      - Batch ${batch.id} | ${date} (${dayOfWeek})`);
        }
        if (recentBatches.length > 15) {
            console.log(`      ... and ${recentBatches.length - 15} more batches`);
        }
    }
    console.log();

    // 4. Get orders in those batches
    let orderCount = 0;
    let averageDailyOutput = 10; // default fallback

    if (recentBatches.length > 0) {
        const batchIds = Array.from(recentBatches).map((b) => b.id);

        const ordersInBatchesResult = await db.execute<{ order_id: string }>(sql`
      SELECT DISTINCT order_id 
      FROM orders_batches 
      WHERE batch_id = ANY(ARRAY[${sql.join(batchIds.map(id => sql`${id}`), sql`, `)}])
    `);
        orderCount = ordersInBatchesResult.length;

        console.log("📦 ORDERS IN THOSE BATCHES:");
        console.log(`   - Unique orders: ${orderCount}`);
        console.log();

        if (orderCount > 0) {
            averageDailyOutput = Math.max(1, Math.round(orderCount / 21));
        }
    }

    console.log("📈 AVERAGE DAILY OUTPUT CALCULATION:");
    console.log(`   - Unique orders in batches: ${orderCount}`);
    console.log(`   - Divided by: 21 days (fixed)`);
    console.log(`   - Average daily output: ${orderCount} / 21 = ${(orderCount / 21).toFixed(2)}`);
    console.log(`   - Rounded: ${averageDailyOutput}`);
    if (recentBatches.length === 0 || orderCount === 0) {
        console.log(`   ⚠️  Using fallback value of 10 (no batch data)`);
    }
    console.log();

    // 5. Calculate days until in session
    const daysTilInSession = Math.ceil(queuedOrdersAhead / averageDailyOutput);

    console.log("⏰ DAYS UNTIL IN SESSION:");
    console.log(`   - Orders ahead: ${queuedOrdersAhead}`);
    console.log(`   - Daily output: ${averageDailyOutput}`);
    console.log(`   - Calculation: ceil(${queuedOrdersAhead} / ${averageDailyOutput}) = ${daysTilInSession}`);
    console.log();

    // 6. Calculate expected ship date (add 3 business days after in session)
    const today = dayjs();
    let expectedDate = today;
    let daysAdded = 0;
    const targetDays = daysTilInSession + 3; // 3 additional business days for processing/shipping

    while (daysAdded < targetDays) {
        expectedDate = expectedDate.add(1, "day");
        const dayOfWeek = expectedDate.day();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            daysAdded++;
        }
    }

    console.log("📅 EXPECTED SHIP DATE CALCULATION:");
    console.log(`   - Today: ${today.format("ddd, MMM D, YYYY")}`);
    console.log(`   - Days until in session: ${daysTilInSession}`);
    console.log(`   - Additional processing days: 3`);
    console.log(`   - Total business days to add: ${targetDays}`);
    console.log(`   - Expected ship date: ${expectedDate.format("ddd, MMM D, YYYY")}`);
    console.log();

    // 7. Show what shugo-cs reported
    console.log("🤖 SHUGO-CS REPORTED:");
    console.log(`   - Expected Ship Date: Sun, Feb 15`);
    console.log(`   - Estimated Completion: 2026-02-15T13:56:04.435Z`);
    console.log();

    console.log("=".repeat(80));
    console.log("SUMMARY:");
    console.log("=".repeat(80));
    console.log(`   Queue Position: ${queuedOrdersAhead + 1} of ${totalQueuedOrders}`);
    console.log(`   Batches in last 21 days: ${recentBatches.length}`);
    console.log(`   Orders processed in those batches: ${orderCount}`);
    console.log(`   Avg Daily Output: ${averageDailyOutput} orders/day`);
    console.log(`   Days to Ship: ${targetDays} business days`);
    console.log(`   Calculated Ship Date: ${expectedDate.format("ddd, MMM D, YYYY")}`);
    console.log();
}

// Get order ID from command line
const orderId = process.argv[2] || "6394528858326";
debugShipDate(orderId)
    .catch(console.error)
    .finally(() => process.exit());
