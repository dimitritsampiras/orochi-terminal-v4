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
import type { EditStaffResponse } from "@/lib/types/api";
import type { EditStaffSchema } from "@/lib/schemas/staff-schema";
import type { profiles, userRoleV4 } from "@drizzle/schema";

type Role = (typeof userRoleV4.enumValues)[number];
type Staff = typeof profiles.$inferSelect;

export function ToggleActiveDialog({
  staff,
  currentUserRole,
  open,
  onOpenChange,
}: {
  staff: Staff;
  currentUserRole: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = staff.isActive ? "deactivate" : "activate";
  const actionPast = staff.isActive ? "deactivated" : "activated";

  const { trigger, isLoading } = useFetcher<EditStaffSchema, EditStaffResponse>({
    path: `/api/staff/${staff.id}`,
    method: "PATCH",
    successMessage: `${staff.username} has been ${actionPast}`,
    errorMessage: `Failed to ${action} staff member`,
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  // Only super_admin can toggle super_admin users
  const canToggle =
    currentUserRole === "super_admin" || staff.roleV4 !== "super_admin";

  const handleToggle = async () => {
    if (!canToggle) return;
    await trigger({ isActive: !staff.isActive });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="capitalize">
            {action} {staff.username}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {staff.isActive
              ? "This user will be logged out and unable to access the system until reactivated."
              : "This user will regain access to the system."}
            {!canToggle && (
              <span className="block mt-2 text-destructive font-medium">
                Only super admins can {action} super admin accounts.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            disabled={!canToggle || isLoading}
            loading={isLoading}
            onClick={handleToggle}
          >
            <span className="capitalize">{action}</span>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

