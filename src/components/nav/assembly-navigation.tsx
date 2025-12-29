"use client";

import { useAssemblyNavigation } from "@/lib/stores/assembly-navigation";
import { useSearchParams } from "next/navigation";
import { NavButton } from "./nav-button";
import { parseGid } from "@/lib/utils";
import { useEffect, useState } from "react";

interface AssemblyNavigationProps {
  itemId: string;
}

/**
 * Navigation component for assembly items with prev/next buttons.
 * Reads navigation context from the assembly navigation store.
 * Only renders when there's valid navigation context.
 */
export const AssemblyNavigation = ({ itemId }: AssemblyNavigationProps) => {
  const searchParams = useSearchParams();
  const { getNavigation, items } = useAssemblyNavigation();
  const { prev, next, position } = getNavigation(itemId);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Build context params to preserve navigation context
  const buildHref = (item: { id: string } | null): string | null => {
    if (!item) return null;
    const params = new URLSearchParams(searchParams.toString());
    return `/assembly/${parseGid(item.id)}?${params.toString()}`;
  };

  const hasNavigation = hasMounted && position !== null;

  if (!hasNavigation) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {position + 1} of {items.length}
      </span>
      <NavButton direction="up" href={buildHref(prev)} />
      <NavButton direction="down" href={buildHref(next)} />
    </div>
  );
};

