// src/lib/hooks/use-bulk-shipments-trigger.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTaskQueue, type TaskItem } from "@/lib/stores/task-queue";
import { toast } from "sonner";
import type { SelectedOrder } from "@/components/dialog/bulk-shipment-dialog";
import { useRouter } from "next/navigation";
import type { BulkPurchaseMetadata, TaskItemStatus } from "@/trigger/bulk-purchase-shipments-v4";

interface UseBulkShipmentsTriggerOptions {
  sessionId: number;
  onComplete?: () => void;
}

interface RunStatusMetadata {
  items?: TaskItemStatus[];
  progress?: number;
  completed?: number;
  failed?: number;
}

interface RunStatus {
  id: string;
  status: string;
  metadata?: RunStatusMetadata;
  output?: { completed: number; failed: number; total: number };
}

export function useBulkShipmentsTrigger({ sessionId, onComplete }: UseBulkShipmentsTriggerOptions) {
  const router = useRouter();
  const { addTask, updateTask, setActiveTask } = useTaskQueue();
  const [runId, setRunId] = useState<string | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for run status updates
  useEffect(() => {
    if (!runId || !taskIdRef.current) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/trigger/status?runId=${runId}`);
        if (!res.ok) return;

        const data: RunStatus = await res.json();
        const taskId = taskIdRef.current!;
        const meta = data.metadata;

        if (meta?.items && Array.isArray(meta.items)) {
          const items: TaskItem[] = meta.items.map((item) => ({
            id: item.id,
            label: item.label,
            status: item.status as TaskItem["status"],
            error: item.error ?? undefined,
          }));

          updateTask(taskId, {
            items,
            progress: meta.progress ?? 0,
          });
        }

        // Handle completion
        if (data.status === "COMPLETED") {
          updateTask(taskId, {
            status: "completed",
            completedAt: Date.now(),
          });
          toast.success(`Bulk shipments complete: ${meta?.completed ?? 0} succeeded, ${meta?.failed ?? 0} failed`);
          onComplete?.();
          router.refresh();
          setRunId(null);
          taskIdRef.current = null;
        }

        // Handle failure
        if (data.status === "FAILED" || data.status === "CRASHED" || data.status === "SYSTEM_FAILURE") {
          updateTask(taskId, { status: "failed" });
          toast.error("Bulk shipment task failed");
          setRunId(null);
          taskIdRef.current = null;
        }

        // Handle cancellation
        if (data.status === "CANCELED") {
          updateTask(taskId, { status: "cancelled" });
          toast.info("Bulk shipment task cancelled");
          setRunId(null);
          taskIdRef.current = null;
        }
      } catch (err) {
        console.error("Failed to poll run status:", err);
      }
    };

    // Poll immediately and then every 2 seconds
    pollStatus();
    pollingRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [runId, updateTask, onComplete, router]);

  const start = useCallback(
    async (selectedOrders: SelectedOrder[]) => {
      if (selectedOrders.length === 0) {
        toast.info("No orders selected");
        return;
      }

      // Create local task immediately for optimistic UI
      const taskId = `bulk-shipments-${sessionId}-${Date.now()}`;
      taskIdRef.current = taskId;

      const items: TaskItem[] = selectedOrders.map((o) => ({
        id: o.orderId,
        label: o.orderName,
        status: "pending",
      }));

      addTask({
        id: taskId,
        type: "bulk_shipments",
        label: `Session ${sessionId} - Bulk Shipments`,
        status: "running",
        items,
        progress: 0,
        sessionId,
      });

      setActiveTask(taskId);

      try {
        // Trigger the server-side task
        const response = await fetch("/api/trigger/bulk-shipments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orders: selectedOrders.map((o) => ({
              orderId: o.orderId,
              orderName: o.orderName,
              status: o.status,
              shipmentId: o.shipmentId,
            })),
            sessionId,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to start bulk shipment task");
        }

        const { runId: newRunId } = await response.json();
        setRunId(newRunId);
        // Store runId in task for cancellation from UI
        updateTask(taskId, { triggerRunId: newRunId });
      } catch (err) {
        updateTask(taskId, { status: "failed" });
        toast.error(err instanceof Error ? err.message : "Failed to start task");
        taskIdRef.current = null;
      }
    },
    [sessionId, addTask, updateTask, setActiveTask]
  );

  const cancel = useCallback(async () => {
    if (!runId) return;

    try {
      await fetch("/api/trigger/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
    } catch (err) {
      console.error("Failed to cancel task:", err);
    }

    router.refresh();
  }, [runId, router]);

  return { start, cancel };
}
