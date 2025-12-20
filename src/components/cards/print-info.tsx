"use client";

import { prints, printLocation } from "@drizzle/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { CreatePrintSchema, UpdatePrintSchema } from "@/lib/schemas/product-schema";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseGid, standardizePrintOrder } from "@/lib/utils";
import { Badge } from "../ui/badge";

type Print = typeof prints.$inferSelect;
type PrintLocation = (typeof printLocation.enumValues)[number];

const PRINT_LOCATIONS: PrintLocation[] = ["front", "back", "left_sleeve", "right_sleeve", "other"];

const formatLocation = (location: string) => location.replace(/_/g, " ");

export function PrintInfoCard({ productId, prints }: { productId: string; prints: Print[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrint, setEditingPrint] = useState<Print | null>(null);

  const emptySlots = Math.max(0, 4 - prints.length);

  const openAddDialog = () => {
    setEditingPrint(null);
    setDialogOpen(true);
  };

  const openEditDialog = (print: Print) => {
    setEditingPrint(print);
    setDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Prints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {standardizePrintOrder(prints).map((print, i) => (
              <Button
                key={print.id}
                variant="fill"
                onClick={() => openEditDialog(print)}
                className="flex flex-col items-center justify-center h-auto p-4"
              >
                <div className="font-medium capitalize">
                  {i + 1}. {formatLocation(print.location)}
                </div>
                {print.heatTransferCode ? (
                  <Badge variant="secondary" className="text-sm text-muted-foreground">
                    {print.heatTransferCode}
                    {print.isSmallPrint && " (Small)"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-blue-600">
                    DTG
                  </Badge>
                )}
              </Button>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <Button key={`empty-${i}`} variant="outline" onClick={openAddDialog} className="h-auto p-4 border-dashed">
                <Icon icon="ph:plus" className="h-5 w-5 text-zinc-400" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <PrintDialog
        productId={productId}
        print={editingPrint}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

// ============================================================================
// PrintDialog Component
// ============================================================================

function PrintDialog({
  productId,
  print,
  open,
  onOpenChange,
  onSuccess,
}: {
  productId: string;
  print: Print | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEditing = print !== null;
  const numericProductId = parseGid(productId);

  const [location, setLocation] = useState<PrintLocation | "">(print?.location || "");
  const [heatTransferCode, setHeatTransferCode] = useState(print?.heatTransferCode || "");
  const [isSmallPrint, setIsSmallPrint] = useState(print?.isSmallPrint || false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Reset form when dialog opens with different print
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      setLocation(print?.location || "");
      setHeatTransferCode(print?.heatTransferCode || "");
      setIsSmallPrint(print?.isSmallPrint || false);
    }
  };

  const { trigger: createTrigger, isLoading: isCreating } = useFetcher<CreatePrintSchema>({
    path: `/api/products/${numericProductId}/prints`,
    method: "POST",
    successMessage: "Print added",
    onSuccess: () => {
      onOpenChange(false);
      onSuccess();
    },
  });

  const { trigger: updateTrigger, isLoading: isUpdating } = useFetcher<UpdatePrintSchema>({
    path: `/api/products/${numericProductId}/prints/${print?.id}`,
    method: "PATCH",
    successMessage: "Print updated",
    onSuccess: () => {
      onOpenChange(false);
      onSuccess();
    },
  });

  const { trigger: deleteTrigger, isLoading: isDeleting } = useFetcher({
    path: `/api/products/${numericProductId}/prints/${print?.id}`,
    method: "DELETE",
    successMessage: "Print deleted",
    onSuccess: () => {
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onSuccess();
    },
  });

  const handleSubmit = () => {
    if (!location) return;

    const data = {
      location,
      heatTransferCode: heatTransferCode || null,
      isSmallPrint: heatTransferCode ? isSmallPrint : false,
    };

    if (isEditing) {
      updateTrigger(data);
    } else {
      createTrigger(data);
    }
  };

  const isLoading = isCreating || isUpdating;
  const isValid = location !== "";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Print" : "Add Print"}</DialogTitle>
            <DialogDescription>
              Configure print details for the assembly line. Heat transfers marked as small are placed at the bottom of
              the queue.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Location Select */}
            <div className="grid gap-2">
              <Label>Print Location</Label>
              <Select value={location} onValueChange={(v) => setLocation(v as PrintLocation)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {PRINT_LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc} className="capitalize">
                      {formatLocation(loc)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Heat Transfer Code */}
            <div className="grid gap-2">
              <Label htmlFor="heatTransferCode">Heat Transfer Code (optional)</Label>
              <Input
                id="heatTransferCode"
                placeholder="e.g. GM12, GM8"
                value={heatTransferCode}
                onChange={(e) => setHeatTransferCode(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">Leave empty if DTG printing is required.</p>
            </div>

            {/* Small Heat Press */}

            <div className="flex items-center space-x-2">
              {heatTransferCode ? (
                <Checkbox
                  id="isSmallPrint"
                  checked={isSmallPrint}
                  onCheckedChange={(checked) => setIsSmallPrint(checked === true)}
                />
              ) : (
                <Checkbox id="sample" checked={false} disabled={true} />
              )}
              <Label htmlFor="isSmallPrint" className="text-sm font-normal">
                Uses small heat press
              </Label>
            </div>
          </div>

          <DialogFooter className={isEditing ? "justify-between!" : ""}>
            {isEditing && (
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid} loading={isLoading}>
                {isEditing ? "Save Changes" : "Add Print"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Print</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this print? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={() => deleteTrigger(null)} loading={isDeleting}>
                Delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
