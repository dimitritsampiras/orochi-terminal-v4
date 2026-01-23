import { db } from "@/lib/clients/db";
import { logs } from "../../../drizzle/schema";
import { logType } from "../../../drizzle/schema";
import { env } from "../env";
import { PgTransaction } from "drizzle-orm/pg-core";
import { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import * as schema from "../../../drizzle/schema";

// Define the input type based on your schema




type LogEntry = typeof logs.$inferInsert;
type LogLevel = (typeof logType.enumValues)[number];

type Transaction = PgTransaction<PostgresJsQueryResultHKT, typeof schema>;

class Logger {
  private async insert(level: LogLevel, entry: LogEntry, tx?: Transaction): Promise<number | undefined> {
    const { message, orderId, profileId, category, type, metadata, lineItemId, batchId } = entry;
    const ctx = tx ?? db;



    try {
      // if (env.SUPPRESS_LOGGING) {
      //   console.log("SUPPRESS_LOGGING is true", message);
      //   return;
      // }

      const [log] = await ctx.insert(logs).values({
        category,
        type: level,
        message,
        orderId,
        profileId,
        metadata,
        lineItemId,
        batchId,
      }).returning({ id: logs.id });

      return log?.id;
    } catch (error) {
      // Fallback to console if DB fails, so you still see it in Vercel/server logs
      console.error("CRITICAL: Failed to save log to DB", error);
    }
  }

  async info(message: string, opts: Omit<LogEntry, "message"> = {}, tx?: Transaction) {
    console.log(`🟢 [INFO] ${message}`); // Keep console for vercel runtime logs
    return await this.insert("INFO", { message, ...opts }, tx);
  }

  async warn(message: string, opts: Omit<LogEntry, "message"> = {}, tx?: Transaction) {
    console.warn(`🟡 [WARN] ${message}`);
    return await this.insert("WARN", { message, ...opts }, tx);
  }

  async error(message: string, opts: Omit<LogEntry, "message"> = {}, tx?: Transaction) {
    console.error(`🔴 [ERROR] ${message}`);
    return await this.insert("ERROR", { message, ...opts }, tx);
  }
}

export const logger = new Logger();
