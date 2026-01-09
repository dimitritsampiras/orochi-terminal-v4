"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import type { DeleteStaffResponse } from "@/lib/types/api";
import type { profiles } from "@drizzle/schema";

type Staff = typeof profiles.$inferSelect;

export function DeleteStaffDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: Staff;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { trigger: deleteStaff, isLoading } = useFetcher<undefined, DeleteStaffResponse>({
    path: `/api/staff/${staff.id}`,
    method: "DELETE",
    successMessage: `${staff.username} has been deleted`,
    errorMessage: "Failed to delete staff member",
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {staff.username}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this staff member's account. This action
            cannot be undone. Consider deactivating instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isLoading}
            loading={isLoading}
            onClick={() => deleteStaff()}
          >
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

