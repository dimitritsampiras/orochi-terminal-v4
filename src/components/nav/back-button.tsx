"use client";
import { Icon } from "@iconify/react";
import { buttonVariants } from "../ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

type BackButtonProps = {
  /** Fallback href when no context is found in search params */
  fallbackHref: string;
  className?: string;
};

/**
 * BackButton that reads navigation context from URL search params.
 *
 * Supported params:
 * - `from=dashboard` -> navigates to /dashboard
 * - `from=orders` -> navigates to /orders
 * - `from=holds` -> navigates to /holds
 * - `from=session&session_id=X` -> navigates to /sessions/X
 * - `from=batch&batch_id=X` -> navigates to /sessions/X
 * - `from=assembly` -> navigates to /assembly
 * - `from=product&product_id=X` -> navigates to /products/X
 * - `from=create_session` -> navigates to /sessions/create
 *
 * Falls back to `fallbackHref` if no valid context is found.
 */
export const BackButton = ({ fallbackHref, className }: BackButtonProps) => {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const sessionId = searchParams.get("session_id");
  const batchId = searchParams.get("batch_id");
  const productId = searchParams.get("product_id");

  const getHref = (): string => {
    switch (from) {
      case "dashboard":
        return "/dashboard";
      case "session":
        return sessionId ? `/sessions/${sessionId}` : fallbackHref;
      case "batch":
        return batchId ? `/sessions/${batchId}` : fallbackHref;
      case "orders":
        return "/orders";
      case "holds":
        return "/holds";
      case "assembly":
        return "/assembly";
      case "product":
        return productId ? `/products/${productId}` : "/products";
      case "products":
        return "/products";
      case "create_session":
        return "/sessions/create";
      default:
        return fallbackHref;
    }
  };

  return (
    <Link href={getHref()} className={cn(buttonVariants({ variant: "outline", size: "icon-md" }), className)}>
      <Icon icon="ph:arrow-left" className="w-4 h-4" />
    </Link>
  );
};
