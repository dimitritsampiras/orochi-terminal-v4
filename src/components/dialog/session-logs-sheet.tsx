"use client";

import { useQuery } from "@tanstack/react-query";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { GetSessionLogsResponse } from "@/lib/types/api";
import { cn } from "@/lib/utils";

interface SessionLogsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
}

export function SessionLogsSheet({
  open,
  onOpenChange,
  sessionId,
}: SessionLogsSheetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["session-logs", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/batches/${sessionId}/logs`);
      const json = (await res.json()) as GetSessionLogsResponse;
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Failed to fetch logs");
      }
      return json.data;
    },
    enabled: open,
  });

  const logs = data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Session Logs</SheetTitle>
          <SheetDescription>
            Activity logs for session #{sessionId}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          {isLoading && (
            <p className="text-center py-8 text-muted-foreground">
              Loading logs...
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {!isLoading && !error && logs.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">
              No logs found for this session.
            </p>
          )}

          {!isLoading && !error && logs.length > 0 && (
            <div className="border rounded-md bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead className="w-[70px]">Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[100px]">User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            log.type === "INFO" && "bg-blue-50 text-blue-700",
                            log.type === "WARN" && "bg-yellow-50 text-yellow-700",
                            log.type === "ERROR" && "bg-red-50 text-red-700"
                          )}
                        >
                          {log.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <span className="text-sm">{log.message}</span>
                        {log.category && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {log.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.profileUsername ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
