"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { SessionOrdersTable } from "@/components/table/session-orders-table";
import type {
  orders,
  lineItems,
  shipments,
  batchDocuments,
  batches,
  userRole,
  orderHolds,
  productVariants,
} from "@drizzle/schema";
import { SessionDocumentsTable } from "../table/session-documents-table";
import { Icon } from "@iconify/react";
import { Button, buttonVariants } from "../ui/button";
import { useRouter } from "next/navigation";
import type { DataResponse } from "@/lib/types/misc";
import { useBulkShipmentsTrigger } from "@/lib/hooks/use-bulk-shipments-trigger";
import { revalidateSessionPages } from "@/lib/actions/revalidate";
import {
  BulkShipmentDialog,
  type SelectedOrder,
  type OrderForBulkShipment,
} from "../dialog/bulk-shipment-dialog";
import { VerifyShipmentsSheet } from "../dialog/verify-shipments-sheet";
import { VerifyPremadeStockSheet } from "../dialog/verify-premade-stock-sheet";
import { VerifyItemSyncDialog } from "../dialog/verify-item-sync";
import { useMutation } from "@tanstack/react-query";
import type { GenerateSessionDocumentsResponse } from "@/lib/types/api";
import type { GenerateSessionDocumentsSchema } from "@/lib/schemas/batch-schema";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { VerifyBlankStockSheet } from "../dialog/verify-blank-stock-sheet";
import { getShipmentIssue } from "@/lib/core/shipping/shipping-utils";
import { orderReadyForFulfillment } from "@/lib/core/session/session.utils";
import { StartSessionSheet } from "../dialog/start-session-dialog";
import Link from "next/link";

export type SessionOrder = typeof orders.$inferSelect & {
  shipments: (typeof shipments.$inferSelect)[];
  lineItems: (typeof lineItems.$inferSelect & {
    productVariant?: typeof productVariants.$inferSelect | null;
  })[];
  isInShippingDoc: boolean;
  orderHolds: (typeof orderHolds.$inferSelect)[];
};

type BatchDocument = typeof batchDocuments.$inferSelect;

interface SessionControllerProps {
  orders: SessionOrder[];
  batchDocuments: BatchDocument[];
  session: typeof batches.$inferSelect;
  userRole: (typeof userRole.enumValues)[number];
}

export function SessionController({
  orders,
  batchDocuments,
  session,
  userRole,
}: SessionControllerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkShipmentDialog, setShowBulkShipmentDialog] = useState(false);
  const [showShippingIssuesDialog, setShowShippingIssuesDialog] =
    useState(false);
  const [showGenerateDocsDialog, setShowGenerateDocsDialog] = useState(false);
  const [showPremadeStockSheet, setShowPremadeStockSheet] = useState(false);
  const [showBlankStockSheet, setShowBlankStockSheet] = useState(false);
  const [showItemSyncDialog, setShowItemSyncDialog] = useState(false);
  const [showStartSessionDialog, setShowStartSessionDialog] = useState(false);

  // Check if session already has documents (picking list or assembly list)
  const hasExistingSessionDocs = batchDocuments.some(
    (doc) =>
      doc.documentType === "picking_list" ||
      doc.documentType === "assembly_list",
  );
  const hasStoredAssemblyLine = !!session.assemblyLineJson;
  const hasStoredPickingList = !!session.pickingListJson;

  const toggleActiveMutation = useMutation({
    mutationFn: async (body: { active: boolean }) => {
      const res = await fetch(`/api/batches/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as DataResponse<
        typeof batches.$inferSelect
      >;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to update session");
      }
      return data;
    },
    onSuccess: () => {
      router.refresh();
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/batches/${session.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as DataResponse<"success">;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to delete session");
      }
      return data;
    },
    onSuccess: () => {
      router.push("/sessions");
    },
  });

  const generateDocsMutation = useMutation({
    mutationFn: async (input: GenerateSessionDocumentsSchema) => {
      const res = await fetch(`/api/batches/${session.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as GenerateSessionDocumentsResponse;

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to generate session documents");
      }

      return data;
    },
    onSuccess: () => {
      toast.success(
        "Session documents generated (Picking List + Assembly List)",
      );
      setShowGenerateDocsDialog(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { start: startBulkShipments } = useBulkShipmentsTrigger({
    sessionId: session.id,
    onComplete: async () => {
      await revalidateSessionPages(session.id);
      router.refresh();
    },
  });

  const handleBulkShipmentConfirm = (selectedOrders: SelectedOrder[]) => {
    startBulkShipments(selectedOrders);
  };

  // Prepare orders for bulk shipment dialog
  const ordersForBulkShipment: OrderForBulkShipment[] = orders.map((order) => ({
    id: order.id,
    name: order.name,
    displayCustomerName: order.displayCustomerName,
    displayDestinationCountryCode: order.displayDestinationCountryCode,
    displayDestinationCountryName: order.displayDestinationCountryName,
    shipments: order.shipments,
  }));

  const ordersWithShippingIssues = orders.filter((order) => {
    const activeHold = order.orderHolds.find((hold) => !hold.isResolved);
    if (activeHold) {
      // active hold means issue is verified
      return false;
    }
    if (!orderReadyForFulfillment(order)) {
      // if its not ready for fulfillment, we dont care if it has shipping issues
      return false;
    }
    const issue = getShipmentIssue(order.shipments);
    return issue !== null;
  });

  // Orders with active holds (for premade stock sheet)
  const ordersWithHolds = useMemo(() => {
    return orders
      .filter((order) => order.orderHolds.some((hold) => !hold.isResolved))
      .map((order) => ({
        orderName: order.name,
        holdCount: order.orderHolds.filter((hold) => !hold.isResolved).length,
      }));
  }, [orders]);

  const handleToggleActive = () => {
    toast.promise(
      toggleActiveMutation.mutateAsync({ active: !session.active }),
      {
        loading: "Toggling session active status...",
        success: "Session active status toggled",
        error: (error) => error.message,
      },
    );
  };

  const handleDeleteSession = () => {
    setShowDeleteDialog(false);
    toast.promise(deleteSessionMutation.mutateAsync(), {
      loading: "Deleting session...",
      success: "Session deleted",
      error: (error) => error.message,
    });
  };

  const handleGenerateSessionDocuments = async () => {
    const lt = toast.loading("Generating session documents...");
    await generateDocsMutation.mutateAsync({});
    router.refresh();
    toast.success(
      "Session documents generated (Picking List + Assembly List)",
      { id: lt },
    );
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) {
      return orders;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();

    return orders.filter(
      (order) =>
        order.name.toLowerCase().includes(lowerSearchTerm) ||
        order.displayCustomerName?.toLowerCase().includes(lowerSearchTerm) ||
        order.displayDestinationCountryName
          ?.toLowerCase()
          .includes(lowerSearchTerm) ||
        order.lineItems.some((li) =>
          li.name.toLowerCase().includes(lowerSearchTerm),
        ),
    );
  }, [orders, searchTerm]);

  const isGeneratingDocs = generateDocsMutation.isPending;
  const isTogglingActive = toggleActiveMutation.isPending;
  const isDeleting = deleteSessionMutation.isPending;
  const isLoading = isTogglingActive || isDeleting || isGeneratingDocs;

  return (
    <div>
      <div className="flex sm:flex-row flex-col gap-2 justify-between mb-4">
        <Input
          placeholder="Search order, line items, customer, country"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-10 w-56 bg-white"
        />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "outline", size: "icon" })}
              disabled={isLoading}
            >
              <Icon icon="ph:dots-three" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <Link href={`/sessions/${session.id}/settle`}>
                <DropdownMenuItem
                  onClick={() => router.push(`/sessions/${session.id}/settle`)}
                  disabled={isLoading}
                >
                  <Icon icon="ph:scales" className="size-4" />
                  Post Session Settlement
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                onClick={handleToggleActive}
                disabled={isLoading}
              >
                <div className="size-4 flex items-center justify-center">
                  {session.active ? (
                    <div className="min-w-1.5 min-h-1.5 rounded-full bg-zinc-300" />
                  ) : (
                    <div className="min-w-1.5 min-h-1.5 rounded-full bg-green-500" />
                  )}
                </div>
                Set As {session.active ? "Inactive" : "Active"}
              </DropdownMenuItem>
              {(userRole === "superadmin" || userRole === "admin") && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isLoading}
                >
                  <Icon icon="ph:trash" className="size-4" />
                  Delete Session
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "outline" })}
              disabled={isLoading}
            >
              Shipping Labels
              <Icon icon="ph:caret-up-down" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => setShowBulkShipmentDialog(true)}
                disabled={isLoading}
              >
                <Icon icon="ph:package" className="size-4" />
                Bulk Purchase Shipments
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "fill" })}
              disabled={isLoading}
            >
              Verify Session
              <Icon icon="ph:caret-up-down" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => setShowShippingIssuesDialog(true)}
                disabled={isLoading}
                className={cn(
                  session.shipmentsVerifiedAt &&
                  "text-emerald-500 hover:text-emerald-500!",
                )}
              >
                <Icon icon="ph:truck" className="size-4 text-inherit" />
                Verify Shipments
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowItemSyncDialog(true)}
                // disabled={isLoading || !session.shipmentsVerifiedAt}
                className={cn(
                  session.itemSyncVerifiedAt &&
                  "text-emerald-500! hover:text-emerald-500!",
                )}
              >
                <Icon
                  icon="ph:link"
                  className={cn(
                    session.itemSyncVerifiedAt && "text-emerald-500",
                    "size-4",
                  )}
                />
                Verify Item Sync
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowPremadeStockSheet(true)}
                // disabled={isLoading || !session.itemSyncVerifiedAt}
                className={cn(
                  session.premadeStockVerifiedAt &&
                  "text-emerald-500! hover:text-emerald-500!",
                )}
              >
                <Icon
                  icon="ph:t-shirt"
                  className={cn(
                    session.premadeStockVerifiedAt && "text-emerald-500",
                    "size-4",
                  )}
                />
                Verify Premade Stock Requirements
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  session.blankStockVerifiedAt &&
                  "text-emerald-500! hover:text-emerald-500!",
                )}
                // disabled={
                //   isLoading ||
                //   !session.itemSyncVerifiedAt ||
                //   !session.premadeStockVerifiedAt
                // }
                onClick={() => setShowBlankStockSheet(true)}
              >
                <Icon
                  icon="ph:package"
                  className={cn(
                    session.blankStockVerifiedAt && "text-emerald-500",
                    "size-4",
                  )}
                />
                Verify Blank Inventory Requirements
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="default"
            disabled={
              !session.premadeStockVerifiedAt ||
              !session.blankStockVerifiedAt ||
              !session.itemSyncVerifiedAt ||
              Boolean(session.startedAt)
            }
            onClick={() => setShowStartSessionDialog(true)}
          >
            Start Session
          </Button>
        </div>
      </div>

      {batchDocuments && batchDocuments.length > 0 && (
        <SessionDocumentsTable documents={batchDocuments} className="mb-8" />
      )}

      <div className="mb-32 mt-4">
        <SessionOrdersTable orders={filteredOrders} sessionId={session.id} />
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session {session.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this session and remove all order
              associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkShipmentDialog
        open={showBulkShipmentDialog}
        onOpenChange={setShowBulkShipmentDialog}
        orders={ordersForBulkShipment}
        sessionId={session.id}
        onConfirm={handleBulkShipmentConfirm}
      />

      <VerifyShipmentsSheet
        open={showShippingIssuesDialog}
        onOpenChange={setShowShippingIssuesDialog}
        orders={ordersWithShippingIssues}
        session={session}
      />

      <StartSessionSheet
        open={showStartSessionDialog}
        onOpenChange={setShowStartSessionDialog}
        sessionId={session.id}
      />

      {/* Generate Session Documents Dialog */}
      <AlertDialog
        open={showGenerateDocsDialog}
        onOpenChange={setShowGenerateDocsDialog}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Session Documents</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              This will generate both the Picking List and Assembly List PDFs
              together and lock in the current sort order and picking
              requirements.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(hasExistingSessionDocs ||
            hasStoredAssemblyLine ||
            hasStoredPickingList) && (
              <Alert>
                <Icon icon="ph:info" className="size-4" />
                <AlertTitle>Existing Data Will Be Overwritten</AlertTitle>
                <AlertDescription className="space-y-4">
                  {hasStoredAssemblyLine && (
                    <p>
                      The stored assembly line sort order will be regenerated. If
                      you've already started physical assembly, the new order may
                      differ if product or blank data has changed.
                    </p>
                  )}
                  {hasStoredPickingList && (
                    <p>
                      The stored picking requirements will be regenerated based on
                      current product/blank sync states.
                    </p>
                  )}
                  {hasExistingSessionDocs && (
                    <p>
                      New PDF documents will be created. Previous documents will
                      remain but may be outdated.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerateSessionDocuments}
              disabled={isGeneratingDocs}
            >
              {isGeneratingDocs ? "Generating..." : "Generate Documents"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VerifyPremadeStockSheet
        open={showPremadeStockSheet}
        onOpenChange={setShowPremadeStockSheet}
        session={session}
        ordersWithHolds={ordersWithHolds}
      />

      <VerifyBlankStockSheet
        open={showBlankStockSheet}
        onOpenChange={setShowBlankStockSheet}
        session={session}
        sessionOrders={orders}
      />

      <VerifyItemSyncDialog
        open={showItemSyncDialog}
        onOpenChange={setShowItemSyncDialog}
        session={session}
      />
    </div>
  );
}
