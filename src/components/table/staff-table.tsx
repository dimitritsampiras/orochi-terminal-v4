"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { RoleBadge } from "@/components/badges/role-badge";
import { ActiveBadge } from "@/components/badges/active-badge";
import { EditStaffForm } from "@/components/forms/staff-forms/edit-staff-form";
import { DeleteStaffDialog } from "@/components/forms/staff-forms/delete-staff-dialog";
import { ToggleActiveDialog } from "@/components/forms/staff-forms/toggle-active-dialog";
import type { profiles, userRoleV4 } from "@drizzle/schema";
import dayjs from "dayjs";

type Role = (typeof userRoleV4.enumValues)[number];
type Staff = typeof profiles.$inferSelect;

export function StaffTable({
  staff,
  currentUserRole,
}: {
  staff: Staff[];
  currentUserRole: Role;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toggleActiveOpen, setToggleActiveOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  const isSuperAdmin = currentUserRole === "super_admin";

  const handleEdit = (s: Staff) => {
    setSelectedStaff(s);
    setEditOpen(true);
  };

  const handleDelete = (s: Staff) => {
    setSelectedStaff(s);
    setDeleteOpen(true);
  };

  const handleToggleActive = (s: Staff) => {
    setSelectedStaff(s);
    setToggleActiveOpen(true);
  };

  return (
    <>
      {selectedStaff && (
        <EditStaffForm
          staff={selectedStaff}
          currentUserRole={currentUserRole}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {selectedStaff && (
        <ToggleActiveDialog
          staff={selectedStaff}
          currentUserRole={currentUserRole}
          open={toggleActiveOpen}
          onOpenChange={setToggleActiveOpen}
        />
      )}

      {selectedStaff && isSuperAdmin && (
        <DeleteStaffDialog
          staff={selectedStaff}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}

      <div className="bg-white rounded-lg shadow-sm border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.length > 0 ? (
              staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold capitalize">{s.username}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={s.roleV4} />
                  </TableCell>
                  <TableCell>
                    <ActiveBadge status={s.isActive} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.createdAt ? dayjs(s.createdAt).format("MMM DD, YYYY") : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={buttonVariants({ variant: "outline", size: "icon-sm" })}
                      >
                        <Icon icon="ph:dots-three" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(s)}>
                          <Icon icon="ph:pencil-simple" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(s)}>
                          {s.isActive ? (
                            <>
                              <Icon icon="ph:prohibit" className="text-amber-600" />
                              <span className="text-amber-600">Deactivate</span>
                            </>
                          ) : (
                            <>
                              <Icon icon="ph:check-circle" className="text-green-600" />
                              <span className="text-green-600">Activate</span>
                            </>
                          )}
                        </DropdownMenuItem>
                        {isSuperAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(s)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Icon icon="ph:trash" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No staff members found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
