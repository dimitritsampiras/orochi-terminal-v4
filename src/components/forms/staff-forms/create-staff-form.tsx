"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
import { Icon } from "@iconify/react";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import type { CreateStaffSchema } from "@/lib/schemas/staff-schema";
import type { CreateStaffResponse } from "@/lib/types/api";
import type { userRoleV4 } from "@drizzle/schema";
import { RoleBadge } from "@/components/badges/role-badge";

type Role = (typeof userRoleV4.enumValues)[number];

const ROLES: { value: Role; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "warehouse_staff", label: "Warehouse Staff" },
  { value: "customer_support", label: "Customer Support" },
  { value: "operator", label: "Line Operator" },
];

export function CreateStaffForm({
  currentUserRole,
}: {
  currentUserRole: Role;
}) {
  const [open, setOpen] = useState(false);

  // Form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("warehouse_staff");

  const { trigger: createStaff, isLoading } = useFetcher<
    CreateStaffSchema,
    CreateStaffResponse
  >({
    path: "/api/staff",
    method: "POST",
    successMessage: "Staff member created successfully",
    errorMessage: "Failed to create staff member",
    onSuccess: () => {
      setOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setRole("warehouse_staff");
  };

  const handleSubmit = async () => {
    if (!username || !email || !password || !role) return;
    await createStaff({ username, email, password, role });
  };

  const isFormValid =
    username.length > 0 &&
    email.length > 0 &&
    password.length >= 6 &&
    role.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <SheetTrigger asChild>
        <Button>
          <Icon icon="ph:plus" />
          Add Staff
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Staff Member</SheetTitle>
          <SheetDescription>
            Create a new staff account. Set their password here.
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

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
        </div>

        <SheetFooter className="border-t absolute bottom-0 left-0 right-0 bg-white">
          <Button disabled={!isFormValid} loading={isLoading} onClick={handleSubmit}>
            Create Staff
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

