"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Icon } from "@iconify/react";
import type { profiles } from "@drizzle/schema";
import { useOperatorStore } from "@/lib/stores/operator-store";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button";

type Profile = typeof profiles.$inferSelect;

interface UserProfileProps {
  user: Profile;
  operators: Profile[];
}

export function UserProfileSwitcher({ user, operators }: UserProfileProps) {
  const { activeOperatorId, setActiveOperator } = useOperatorStore();

  // Check if this is the generic warehouse account
  const isGenericWarehouse = user.roleV4 === "operator";

  // If normal user, just show their info
  if (!isGenericWarehouse) {
    return (
      <Link
        href="/profile"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "flex items-center justify-start! w-full px-4 py-4 mx-2 h-fit!"
        )}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-zinc-100 text-zinc-600 border border-zinc-200">
            {user.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col overflow-hidden">
          <span className="text-sm font-medium truncate capitalize">
            {user.username}
          </span>
          <span className="text-xs text-muted-foreground truncate capitalize">
            {user.roleV4?.replace("_", " ")}
          </span>
        </div>
      </Link>
    );
  }

  // If generic account, show the switcherA
  const selectedOperator = operators.find((op) => op.id === activeOperatorId);

  return (
    <div className="px-4 w-full">
      <Select
        value={activeOperatorId || ""}
        onValueChange={(val) => setActiveOperator(val || null)}
      >
        <SelectTrigger className="w-full bg-white">
          <SelectValue placeholder="Select Operator">
            {selectedOperator ? (
              <div className="flex items-center gap-2">
                <Avatar className="size-5">
                  <AvatarFallback className="text-[10px] bg-indigo-50 text-indigo-700">
                    {selectedOperator.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{selectedOperator.username}</span>
              </div>
            ) : (
              "Select Operator"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {operators.filter((op) => op.roleV4 === 'warehouse_staff').map((op) => (
            <SelectItem key={op.id} value={op.id}>
              {op.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
