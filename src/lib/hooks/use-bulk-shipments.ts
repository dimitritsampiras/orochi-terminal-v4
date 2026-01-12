// src/lib/hooks/use-bulk-shipments.ts
import { useCallback, useRef } from "react";
import { useTaskQueue, type TaskItem } from "@/lib/stores/task-queue";
import { sleep, parseGid } from "@/lib/utils";
import { toast } from "sonner";
import type { SelectedOrder, ShipmentStatus } from "@/components/dialog/bulk-shipment-dialog";

interface UseBulkShipmentsOptions {
  sessionId: number;
  onComplete?: () => void;
  delayMs?: number; // Delay between requests (default 2000ms)
}

export function useBulkShipments({ sessionId, onComplete, delayMs = 2000 }: UseBulkShipmentsOptions) {
  const abortRef = useRef(false);
  const { addTask, updateTask, updateTaskItem, setActiveTask } = useTaskQueue();

  const start = useCallback(
    async (selectedOrders: SelectedOrder[]) => {
      if (selectedOrders.length === 0) {
        toast.info("No orders selected");
        return;
      }

      const taskId = `bulk-shipments-${sessionId}-${Date.now()}`;
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
      abortRef.current = false;

      let completed = 0;
      let failed = 0;

      for (const order of selectedOrders) {
        if (abortRef.current) {
          updateTask(taskId, { status: "cancelled" });
          toast.info("Bulk shipment creation cancelled");
          break;
        }

        const orderId = parseGid(order.orderId);
        updateTaskItem(taskId, order.orderId, { status: "running" });

        try {
          await processOrder(order, orderId!, sessionId);
          updateTaskItem(taskId, order.orderId, { status: "completed" });
          completed++;
        } catch (error) {
          updateTaskItem(taskId, order.orderId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          failed++;
        }

        const progress = Math.round(((completed + failed) / selectedOrders.length) * 100);
        updateTask(taskId, { progress });

        // Add delay between requests to avoid rate limiting
        if (!abortRef.current && completed + failed < selectedOrders.length) {
          await sleep(delayMs);
        }
      }

      if (!abortRef.current) {
        updateTask(taskId, {
          status: "completed",
          completedAt: Date.now(),
        });

        toast.success(`Bulk shipments complete: ${completed} succeeded, ${failed} failed`);
        onComplete?.();
      }
    },
    [sessionId, addTask, updateTask, updateTaskItem, setActiveTask, onComplete, delayMs]
  );

  const cancel = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { start, cancel };
}

/**
 * Process a single order based on its shipment status
 * - none/refunded: Create new shipment with autoPurchase
 * - unpurchased: Purchase existing shipment
 */
async function processOrder(order: SelectedOrder, orderId: string, sessionId: number): Promise<void> {
  const { status, shipmentId } = order;

  if (status === "unpurchased" && shipmentId) {
    // Purchase existing unpurchased shipment
    const response = await fetch(`/api/orders/${orderId}/shipments/${shipmentId}/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: String(sessionId) }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to purchase shipment");
    }
  } else {
    // Create new shipment with autoPurchase (for "none" or "refunded" status)
    const response = await fetch(`/api/orders/${orderId}/shipments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autoPurchase: true,
        sessionId: sessionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to create shipment");
    }
  }
}
