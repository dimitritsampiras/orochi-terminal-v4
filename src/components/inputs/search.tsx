"use client";

import { Icon } from "@iconify/react";
import React, { useTransition } from "react";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "../ui/spinner";
import { Button } from "../ui/button";

export type SearchProps = React.InputHTMLAttributes<HTMLInputElement>;

const Search = React.forwardRef<HTMLInputElement, SearchProps>(({ className, ...props }, ref) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("q", value.trim());

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, {
        scroll: false,
      });
    });
  };

  return (
    <div className="relative">
      {!isPending ? (
        <Icon
          icon="ph:magnifying-glass"
          className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
      ) : (
        <Spinner className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      )}

      <Input
        disabled={isPending}
        {...props}
        type="text"
        className={cn("pl-8 bg-white", className)}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleChange(e.currentTarget.value);
          }
        }}
      />
    </div>
  );
});

Search.displayName = "Search";

export { Search };
