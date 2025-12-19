"use client";

import { useLocalServer } from "@/lib/hooks/use-local-server";
import MobileMenu from "./mobile-menu";

import { useRouter } from "next/navigation";
import { FSConnectedBadge } from "../badges/fs-connected-badge";

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

      <div>
       <FSConnectedBadge status={isConnected} />
        {/* <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex gap-4 items-center h-fit w-fit py-1 px-1! md:px-2.5 rounded-full md:rounded-lg"
            >
              <Avatar className="size-10 md:size-8">
                <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium">{user.username}</p>
                <p className="text-xs text-gray-500">{user.role.replace("_", " ")}</p>
              </div>
              <Icon icon="ph:caret-down-bold" className="size-3 text-zinc-400 hidden md:flex" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => router.push("/profile")}>View Profile</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> */}
      </div>
    </div>
  );
}

export { Header };
