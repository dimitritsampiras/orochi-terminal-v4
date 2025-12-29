"use client";

import { useOrderNavigation } from "@/lib/stores/order-navigation";
import { useSearchParams } from "next/navigation";
import { NavButton } from "./nav-button";
import { parseGid } from "@/lib/utils";
import { useEffect, useState } from "react";

interface OrderNavigationProps {
  orderId: string;
}

/**
 * Navigation component for orders with prev/next buttons.
 * Reads navigation context from the order navigation store.
 * Only renders when there's valid navigation context.
 */
export const OrderNavigation = ({ orderId }: OrderNavigationProps) => {
  const searchParams = useSearchParams();
  const { getNavigation, items, context } = useOrderNavigation();
  const { prev, next, position } = getNavigation(orderId);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Build context params to preserve navigation context
  const buildHref = (item: { id: string } | null): string | null => {
    if (!item) return null;
    const params = new URLSearchParams(searchParams.toString());
    return `/orders/${parseGid(item.id)}?${params.toString()}`;
  };

  const hasNavigation = hasMounted && position !== null;

  if (!hasNavigation) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {position + 1} of {items.length}
      </span>
      <NavButton direction="prev" href={buildHref(prev)} />
      <NavButton direction="next" href={buildHref(next)} />
    </div>
  );
};

