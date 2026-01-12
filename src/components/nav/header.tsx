"use client";

import { useLocalServer } from "@/lib/hooks/use-local-server";
import MobileMenu from "./mobile-menu";

import { useRouter } from "next/navigation";
import { FSConnectedBadge } from "../badges/fs-connected-badge";
import { TaskProgressWidget } from "../dialog/task-progress-popover";

interface HeaderProps {
  // user: typeof profiles.$inferSelect;
}

function Header({}: HeaderProps) {
  const router = useRouter();
  const { isConnected } = useLocalServer();

  return (
    <div className="h-16 w-full flex items-center justify-between px-4 md:px-8">
      <div className="md:hidden flex">
        <MobileMenu />
      </div>
      <div className="text-zinc-400 text-xs">Warehouse Terminal</div>

      <div className="flex items-center gap-2">
        <FSConnectedBadge status={isConnected} />
        <TaskProgressWidget />
      </div>
    </div>
  );
}

export { Header };
