
import "dotenv/config";
import { db } from "../src/lib/clients/db";
import shopify from "../src/lib/clients/shopify";
import { orders as ordersTable } from "../drizzle/schema";
import { and, eq, gt } from "drizzle-orm";
import fs from "fs";
import path from "path";

const BATCH_SIZE = 50;

async function main() {
    console.log("Analyzing queued orders...");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    console.log(`Fetching orders created after ${cutoffDate.toISOString()}...`);

    // Query DB using select
    const queuedOrders = await db
        .select({
            id: ordersTable.id,
            name: ordersTable.name,
        })
        .from(ordersTable)
        .where(
            and(
                eq(ordersTable.queued, true),
                gt(ordersTable.createdAt, cutoffDate),
                eq(ordersTable.displayFulfillmentStatus, "UNFULFILLED")
            )
        );

    console.log(`Found ${queuedOrders.length} orders matching criteria.`);

    if (queuedOrders.length === 0) {
        console.log("No orders found. Exiting.");
        return;
    }

    const orderIds = queuedOrders.map((o) => o.id);
    const emails: string[] = [];

    // Batch fetch from Shopify
    for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
        const batchIds = orderIds.slice(i, i + BATCH_SIZE);
        console.log(`Fetching emails for batch ${i / BATCH_SIZE + 1} (${batchIds.length} orders)...`);

        const query = `
      query GetOrderEmails($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Order {
            id
            email
          }
        }
      }
    `;

        try {
            const response = await shopify.request(query, {
                variables: { ids: batchIds },
            });

            if (response.errors) {
                console.error("GraphQL Errors:", response.errors);
                continue;
            }

            if (response.data?.nodes) {
                for (const node of response.data.nodes) {
                    if (node && node.email) {
                        emails.push(node.email);
                    }
                }
            }
        } catch (e) {
            console.error(`Error fetching batch starting at index ${i}:`, e);
        }
    }

    console.log(`Collected ${emails.length} emails.`);

    // Write to CSV
    const csvContent = "email\n" + emails.join("\n");
    const outputPath = path.join(process.cwd(), "queued_emails.csv");

    fs.writeFileSync(outputPath, csvContent);
    console.log(`Successfully wrote emails to ${outputPath}`);
}

main().catch(console.error).finally(() => process.exit());
