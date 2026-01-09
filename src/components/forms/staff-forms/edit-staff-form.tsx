"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import type { EditStaffSchema } from "@/lib/schemas/staff-schema";
import type { EditStaffResponse } from "@/lib/types/api";
import type { profiles, userRoleV4 } from "@drizzle/schema";
import { RoleBadge } from "@/components/badges/role-badge";

type Role = (typeof userRoleV4.enumValues)[number];
type Staff = typeof profiles.$inferSelect;

const ROLES: { value: Role; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "warehouse_staff", label: "Warehouse Staff" },
  { value: "customer_support", label: "Customer Support" },
];

export function EditStaffForm({
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
  // Form state
  const [username, setUsername] = useState(staff.username);
  const [email, setEmail] = useState(staff.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(staff.roleV4);

  // Reset form when staff changes
  useEffect(() => {
    if (open) {
      setUsername(staff.username);
      setEmail(staff.email);
      setPassword("");
      setRole(staff.roleV4);
    }
  }, [staff, open]);

  const { trigger: editStaff, isLoading } = useFetcher<
    EditStaffSchema,
    EditStaffResponse
  >({
    path: `/api/staff/${staff.id}`,
    method: "PATCH",
    successMessage: "Staff member updated successfully",
    errorMessage: "Failed to update staff member",
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const handleSubmit = async () => {
    const payload: EditStaffSchema = {};
    
    if (username !== staff.username) payload.username = username;
    if (email !== staff.email) payload.email = email;
    if (password.length > 0) payload.password = password;
    if (role !== staff.roleV4) payload.role = role;

    if (Object.keys(payload).length === 0) {
      onOpenChange(false);
      return;
    }

    await editStaff(payload);
  };

  const isFormValid =
    username.length > 0 &&
    email.length > 0 &&
    (password.length === 0 || password.length >= 6);

  const canEditRole = currentUserRole === "super_admin" || staff.roleV4 !== "super_admin";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit {staff.username}</SheetTitle>
          <SheetDescription>
            Update staff details. Leave password empty to keep current.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">New Password (optional)</Label>
            <Input
              id="password"
              type="password"
              placeholder="Leave empty to keep current"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {canEditRole && (
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(value) => setRole(value as Role)}>
                <SelectTrigger className="w-full bg-white!">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem
                      key={r.value}
                      value={r.value}
                      disabled={r.value === "super_admin" && currentUserRole !== "super_admin"}
                    >
                      <RoleBadge role={r.value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <SheetFooter className="border-t absolute bottom-0 left-0 right-0 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!isFormValid} loading={isLoading} onClick={handleSubmit}>
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

