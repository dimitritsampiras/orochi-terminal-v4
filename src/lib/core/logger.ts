import { db } from "@/lib/clients/db";
import { logs } from "../../../drizzle/schema";
import { logType } from "../../../drizzle/schema";
import { env } from "../env";

// Define the input type based on your schema

type LogEntry = typeof logs.$inferInsert;
type LogLevel = (typeof logType.enumValues)[number];
class Logger {
  private async insert(level: LogLevel, entry: LogEntry): Promise<number | undefined> {
    const { message, orderId, profileId, category, type, metadata } = entry;

    try {
      // if (env.SUPPRESS_LOGGING) {
      //   console.log("SUPPRESS_LOGGING is true", message);
      //   return;
      // }

      const [log] = await db.insert(logs).values({
        category,
        type: level,
        message,
        orderId,
        profileId,
        metadata,
      }).returning({ id: logs.id });

      return log?.id;
    } catch (error) {
      // Check if this is a foreign key constraint violation for orderId
      // The error could be in the main message or in the cause (Drizzle wraps PostgreSQL errors)
      const errorMessage = error instanceof Error ? error.message : '';
      const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : '';
      const fullErrorText = `${errorMessage} ${causeMessage}`;
      const isForeignKeyError = fullErrorText.includes('foreign key constraint') ||
        fullErrorText.includes('logs_order_id_fkey') ||
        fullErrorText.includes('violates foreign key');

      if (isForeignKeyError && orderId) {
        // Retry without orderId, storing it in metadata instead
        try {
          const [log] = await db.insert(logs).values({
            category,
            type: level,
            message,
            profileId,
            metadata: { ...((metadata as object) || {}), unmatchedOrderId: orderId },
          }).returning({ id: logs.id });

          return log?.id;
        } catch (retryError) {
          console.error("CRITICAL: Failed to save log to DB (retry without orderId)", retryError);
        }
      } else {
        // Fallback to console if DB fails, so you still see it in Vercel/server logs
        console.error("CRITICAL: Failed to save log to DB", error);
      }
    }
  }

  async info(message: string, opts: Omit<LogEntry, "message"> = {}) {
    console.log(`🟢 [INFO] ${message}`); // Keep console for vercel runtime logs
    return await this.insert("INFO", { message, ...opts });
  }

  async warn(message: string, opts: Omit<LogEntry, "message"> = {}) {
    console.warn(`🟡 [WARN] ${message}`);
    return await this.insert("WARN", { message, ...opts });
  }

  async error(message: string, opts: Omit<LogEntry, "message"> = {}) {
    console.error(`🔴 [ERROR] ${message}`);
    return await this.insert("ERROR", { message, ...opts });
  }
}

export const logger = new Logger();
