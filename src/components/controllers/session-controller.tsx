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

  const { trigger: generateAssemblyList, isLoading: isGeneratingAssemblyList } = useFetcher<
    { documentType: "assembly_list" },
    DataResponse<BatchDocument>
  >({
    path: `/api/batches/${session.id}/documents`,
    method: "POST",
    successMessage: "Assembly list generated",
    errorMessage: "Failed to generate assembly list",
    loadingMessage: "Generating assembly list...",
    onSuccess: () => {
      router.refresh();
    },
  });

  const { trigger: generatePickingList, isLoading: isGeneratingPickingList } = useFetcher<
    { documentType: "picking_list" },
    DataResponse<BatchDocument>
  >({
    path: `/api/batches/${session.id}/documents`,
    method: "POST",
    successMessage: "Picking list generated",
    errorMessage: "Failed to generate picking list",
    loadingMessage: "Generating picking list...",
    onSuccess: () => {
      router.refresh();
    },
  });

  const handleToggleActive = () => {
    toggleActive({ active: !session.active });
  };

  const handleDeleteSession = () => {
    setShowDeleteDialog(false);
    deleteSession();
  };

  const handleGenerateAssemblyList = () => {
    generateAssemblyList({ documentType: "assembly_list" });
  };

  const handleGeneratePickingList = () => {
    generatePickingList({ documentType: "picking_list" });
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

  const isLoading = isTogglingActive || isDeleting || isGeneratingAssemblyList || isGeneratingPickingList;

  return (
    <div>
      <div className="flex justify-between mb-4">
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
              <DropdownMenuItem onClick={handleToggleActive} disabled={isLoading}>
                Set As {session.active ? "Inactive" : "Active"}
              </DropdownMenuItem>
              {(userRole === "superadmin" || userRole === "admin") && (
                <DropdownMenuItem variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isLoading}>
                  Delete Session
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: "default" })} disabled={isLoading}>
              Generate Documents
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem disabled={isLoading}>Merged Packing Slips</DropdownMenuItem>
              <DropdownMenuItem onClick={handleGeneratePickingList} disabled={isLoading}>
                {isGeneratingPickingList ? "Generating..." : "Picking List"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleGenerateAssemblyList} disabled={isLoading}>
                {isGeneratingAssemblyList ? "Generating..." : "Assembly List"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
    </div>
  );
}
