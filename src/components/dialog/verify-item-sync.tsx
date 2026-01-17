"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { parseGid, sleep } from "@/lib/utils";
import Link from "next/link";
import { Icon } from "@iconify/react";
import type { GetSessionLineItemsResponse } from "@/lib/types/api";

import { useRouter } from "next/navigation";

interface VerifyItemSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  isVerified: boolean;
  verifiedAt: Date | null;
}

export function VerifyItemSyncDialog({
  open,
  onOpenChange,
  sessionId,
  isVerified,
  verifiedAt,
}: VerifyItemSyncDialogProps) {
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ["session-line-items", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/batches/${sessionId}/line-items`);
      const json = (await res.json()) as GetSessionLineItemsResponse;
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Failed to fetch line items");
      }
      return json.data;
    },
    enabled: open,
  });

  const lineItems = data?.lineItems ?? [];

  // Find items with issues
  const { unsyncedPrints, unsyncedBlanks } = useMemo(() => {
    const unsyncedPrints = lineItems.filter(
      (item) => item.prints.length === 0 && !item.product?.isBlackLabel && item.product?.id
    );
    const unsyncedBlanks = lineItems.filter(
      (item) => !item.blankVariant && !item.product?.isBlackLabel && item.product?.id
    );
    return { unsyncedPrints, unsyncedBlanks };
  }, [lineItems]);

  const hasIssues = unsyncedPrints.length > 0 || unsyncedBlanks.length > 0;

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/batches/${sessionId}/verify-item-sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to verify");
      }
      return data;
    },
    onSuccess: async () => {
      await router.refresh();
      await sleep(1000);
      toast.success("Item sync verified");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verify Item Sync</DialogTitle>
          <DialogDescription>
            Ensure all products have prints and blanks configured before verifying inventory.
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isLoading && <p className="text-center py-8 text-muted-foreground">Loading line items...</p>}

        {/* Error state */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && (
          <>
            {/* Already verified */}
            {isVerified && (
              <Alert className="bg-green-50 border-green-200">
                <Icon icon="ph:check-circle" className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Verified</AlertTitle>
                <AlertDescription className="text-green-700">
                  Item sync was verified on {verifiedAt ? new Date(verifiedAt).toLocaleString() : "unknown"}.
                </AlertDescription>
              </Alert>
            )}

            {/* No issues */}
            {!hasIssues && !isVerified && (
              <Alert className="bg-blue-50 border-blue-200">
                <Icon icon="ph:check" className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">All items synced</AlertTitle>
                <AlertDescription className="text-blue-700">
                  All {lineItems.length} items have prints and blanks configured.
                </AlertDescription>
              </Alert>
            )}

            {/* Unsynced Prints */}
            {unsyncedPrints.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-orange-700">Missing Prints</h3>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700">
                    {unsyncedPrints.length}
                  </Badge>
                </div>
                <div className="border rounded-md bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unsyncedPrints.slice(0, 10).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-[300px] truncate">{item.name}</TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/products/${parseGid(item.product?.id ?? "")}`}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              Configure →
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {unsyncedPrints.length > 10 && (
                    <p className="text-sm text-muted-foreground p-2 text-center">
                      ...and {unsyncedPrints.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Unsynced Blanks */}
            {unsyncedBlanks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-red-700">Missing Blanks</h3>
                  <Badge variant="outline" className="bg-red-50 text-red-700">
                    {unsyncedBlanks.length}
                  </Badge>
                </div>
                <div className="border rounded-md bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unsyncedBlanks.slice(0, 10).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="max-w-[300px] truncate">{item.name}</TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/products/${parseGid(item.product?.id ?? "")}`}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              Configure →
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {unsyncedBlanks.length > 10 && (
                    <p className="text-sm text-muted-foreground p-2 text-center">
                      ...and {unsyncedBlanks.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => verifyMutation.mutate()}
            disabled={hasIssues || verifyMutation.isPending || isVerified || isLoading}
            loading={verifyMutation.isPending}
          >
            Mark as Verified
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
