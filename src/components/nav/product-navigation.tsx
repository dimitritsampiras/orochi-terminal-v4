"use client";

import { useProductNavigation } from "@/lib/stores/product-navigation";
import { useSearchParams } from "next/navigation";
import { NavButton } from "./nav-button";
import { parseGid } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ProductNavigationProps {
  productId: string;
}

/**
 * Navigation component for products with prev/next buttons.
 * Reads navigation context from the product navigation store.
 * Only renders when there's valid navigation context.
 */
export const ProductNavigation = ({ productId }: ProductNavigationProps) => {
  const searchParams = useSearchParams();
  const { getNavigation, items } = useProductNavigation();
  const { prev, next, position } = getNavigation(productId);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Build context params to preserve navigation context
  const buildHref = (item: { id: string } | null): string | null => {
    if (!item) return null;
    const params = new URLSearchParams(searchParams.toString());
    return `/products/${parseGid(item.id)}?${params.toString()}`;
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

