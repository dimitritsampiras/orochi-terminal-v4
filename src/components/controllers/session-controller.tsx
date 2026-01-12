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
import { orders, lineItems, shipments, batchDocuments, batches, userRole } from "@drizzle/schema";
import { SessionDocumentsTable } from "../table/session-documents-table";
import { Icon } from "@iconify/react";
import { buttonVariants } from "../ui/button";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { useRouter } from "next/navigation";
import { DataResponse } from "@/lib/types/misc";
import { useBulkShipments } from "@/lib/hooks/use-bulk-shipments";
import { revalidateSessionPages } from "@/lib/actions/revalidate";
import { BulkShipmentDialog, type SelectedOrder, type OrderForBulkShipment } from "../dialog/bulk-shipment-dialog";
import { Spinner } from "../ui/spinner";
import { useMutation } from "@tanstack/react-query";
import { GenerateSessionDocumentsResponse } from "@/lib/types/api";
import { GenerateSessionDocumentsSchema } from "@/lib/schemas/batch-schema";
import { toast } from "sonner";
import Link from "next/link";

type Order = typeof orders.$inferSelect & {
  shipments: (typeof shipments.$inferSelect)[];
  lineItems: (typeof lineItems.$inferSelect)[];
  isInShippingDoc: boolean;
};

type BatchDocument = typeof batchDocuments.$inferSelect;

interface SessionControllerProps {
  orders: Order[];
  batchDocuments: BatchDocument[];
  session: typeof batches.$inferSelect;
  userRole: (typeof userRole.enumValues)[number];
}

export function SessionController({ orders, batchDocuments, session, userRole }: SessionControllerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkShipmentDialog, setShowBulkShipmentDialog] = useState(false);
  const [showGenerateDocsDialog, setShowGenerateDocsDialog] = useState(false);

  // Check if session already has documents (picking list or assembly list)
  const hasExistingSessionDocs = batchDocuments.some(
    (doc) => doc.documentType === "picking_list" || doc.documentType === "assembly_list"
  );
  const hasStoredAssemblyLine = !!session.assemblyLineJson;
  const hasStoredPickingList = !!session.pickingListJson;

  const { trigger: toggleActive, isLoading: isTogglingActive } = useFetcher<
    { active: boolean },
    DataResponse<typeof batches.$inferSelect>
  >({
    path: `/api/batches/${session.id}`,
    method: "PATCH",
    successMessage: session.active ? "Session deactivated" : "Session set as active",
    errorMessage: "Failed to update session",
    loadingMessage: "Toggling session active status...",
  });

  const { trigger: deleteSession, isLoading: isDeleting } = useFetcher<undefined, DataResponse<"success">>({
    path: `/api/batches/${session.id}`,
    method: "DELETE",
    successMessage: "Session deleted",
    errorMessage: "Failed to delete session",
    loadingMessage: "Deleting session...",
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
      toast.success("Session documents generated (Picking List + Assembly List)");
      setShowGenerateDocsDialog(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { start: startBulkShipments } = useBulkShipments({
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

  const handleToggleActive = () => {
    toggleActive({ active: !session.active });
  };

  const handleDeleteSession = () => {
    setShowDeleteDialog(false);
    deleteSession();
  };

  const handleGenerateSessionDocuments = async () => {
    const lt = toast.loading("Generating session documents...");
    await generateDocsMutation.mutateAsync({});
    toast.success("Session documents generated (Picking List + Assembly List)", { id: lt });
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
        order.displayDestinationCountryName?.toLowerCase().includes(lowerSearchTerm) ||
        order.lineItems.some((li) => li.name.toLowerCase().includes(lowerSearchTerm))
    );
  }, [orders, searchTerm]);

  const isGeneratingDocs = generateDocsMutation.isPending;
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
            <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "icon" })} disabled={isLoading}>
              <Icon icon="ph:dots-three" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowBulkShipmentDialog(true)} disabled={isLoading}>
                <Icon icon="ph:package" className="size-4" />
                Bulk Purchase Shipments
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleActive} disabled={isLoading}>
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
                <DropdownMenuItem variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isLoading}>
                  <Icon icon="ph:trash" className="size-4" />
                  Delete Session
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: "fill" })} disabled={isLoading}>
              Generate Documents
              <Icon icon="ph:caret-up-down" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem disabled={isLoading}>
                <Icon icon="ph:files" className="size-4" />
                Merged Packing Slips
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowGenerateDocsDialog(true)} disabled={isLoading}>
                <Icon icon="ph:clipboard-text" className="size-4" />
                {isGeneratingDocs && <Spinner />} Picking + Assembly
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href={`/sessions/${session.id}/settle`} className={buttonVariants({ variant: "default" })}>
            Settle Session
          </Link>
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
              This will permanently delete this session and remove all order associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-red-600 hover:bg-red-700">
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

      {/* Generate Session Documents Dialog */}
      <AlertDialog open={showGenerateDocsDialog} onOpenChange={setShowGenerateDocsDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Session Documents</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              This will generate both the Picking List and Assembly List PDFs together and lock in the current sort
              order and picking requirements.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(hasExistingSessionDocs || hasStoredAssemblyLine || hasStoredPickingList) && (
            <Alert>
              <Icon icon="ph:info" className="size-4" />
              <AlertTitle>Existing Data Will Be Overwritten</AlertTitle>
              <AlertDescription className="space-y-4">
                {hasStoredAssemblyLine && (
                  <p>
                    The stored assembly line sort order will be regenerated. If you've already started physical
                    assembly, the new order may differ if product or blank data has changed.
                  </p>
                )}
                {hasStoredPickingList && (
                  <p>The stored picking requirements will be regenerated based on current product/blank sync states.</p>
                )}
                {hasExistingSessionDocs && (
                  <p>New PDF documents will be created. Previous documents will remain but may be outdated.</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateSessionDocuments} disabled={isGeneratingDocs}>
              {isGeneratingDocs ? "Generating..." : "Generate Documents"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
