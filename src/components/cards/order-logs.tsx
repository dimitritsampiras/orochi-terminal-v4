"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { logs } from "../../../drizzle/schema";

type Log = typeof logs.$inferSelect;

interface OrderLogsProps {
  logs: Log[];
  className?: string;
}

// create a better timeline that consolodates logs within the same time frame
export function OrderLogs({ logs, className }: OrderLogsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Order Logs</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length > 0 ? (
          <div className="flex flex-col gap-2">
            {logs.map((log, index) => {
              return (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg text-sm px-2",
                    log.type === "INFO" && "border-zinc-200 bg-white text-zinc-900",
                    log.type === "WARN" && "border-amber-200 bg-amber-50 text-amber-900 px-2 py-1",
                    log.type === "ERROR" && "border-red-200 bg-red-50 text-red-900 px-2 py-1"
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground opacity-70">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "numeric",
                            hour12: true,
                          })
                        : "Unknown Date"}
                    </span>
                    <span>{log.message}</span>
                  </div>
                  <div className="shrink-0">
                    <span className="text-[10px] uppercase font-semibold opacity-50 tracking-wider">{log.type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No logs yet</div>
        )}
      </CardContent>
    </Card>
  );
}
