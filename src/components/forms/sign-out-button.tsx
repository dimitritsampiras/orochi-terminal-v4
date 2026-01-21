"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { LoginResponse as LogoutResponse } from "@/lib/types/api";

export function SignOutButton() {
  const router = useRouter();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      return response.json() as Promise<LogoutResponse>;
    },
    onSuccess: () => {
      router.push("/auth/login");
    },
  });

  return (
    <Button
      variant="outline"
      onClick={() => mutate()}
      loading={isPending}
    >
      Sign Out
    </Button>
  );
}

