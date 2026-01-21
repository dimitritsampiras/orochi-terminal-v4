"use client";

import { useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { ProductStatusBadge } from "@/components/badges/product-status-badge";
import { cn } from "@/lib/utils";
import { GetProductsResponse } from "@/lib/types/api";
import { Badge } from "../ui/badge";
import { Icon } from "@iconify/react";

interface FilterProductsFromQueueSheetProps {
  className?: string;
  onApply?: (selectedVariantIds: string[]) => void;
  initialSelection?: Set<string>;
}

type Product = NonNullable<GetProductsResponse["data"]>[number];

export function FilterProductsFromQueueSheet({
  className,
  onApply,
  initialSelection,
}: FilterProductsFromQueueSheetProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());

  // Sync local state with prop when sheet opens
  useEffect(() => {
    if (open && initialSelection) {
      setSelectedVariantIds(new Set(initialSelection));
    }
  }, [open, initialSelection]);

  // Fetch all products once when sheet opens
  useEffect(() => {
    if (!open) return;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/products");
        const json = (await res.json()) as GetProductsResponse;
        if (json.data) {
          setProducts(json.data);
        }
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [open]);

  // Client-side filtering
  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, query]);

  // Stocked variants (warehouseInventory > 0)
  const stockedVariantIds = useMemo(() => {
    const ids = new Set<string>();
    products.forEach((p) => {
      p.productVariants.forEach((v) => {
        if (v.warehouseInventory > 0) ids.add(v.id);
      });
    });
    return ids;
  }, [products]);

  // Tri-state for stocked products button
  const stockedSelectionState = useMemo(() => {
    if (stockedVariantIds.size === 0) return "none";
    const selectedStockedCount = [...stockedVariantIds].filter((id) => selectedVariantIds.has(id)).length;
    if (selectedStockedCount === 0) return "none";
    if (selectedStockedCount === stockedVariantIds.size) return "all";
    return "partial";
  }, [stockedVariantIds, selectedVariantIds]);

  const handleSelectStocked = () => {
    if (stockedSelectionState === "all") {
      // Deselect all stocked
      const next = new Set(selectedVariantIds);
      stockedVariantIds.forEach((id) => next.delete(id));
      setSelectedVariantIds(next);
    } else {
      // Select all stocked
      const next = new Set(selectedVariantIds);
      stockedVariantIds.forEach((id) => next.add(id));
      setSelectedVariantIds(next);
    }
  };

  // All variant ids
  const allVariantIds = useMemo(() => {
    const ids = new Set<string>();
    products.forEach((p) => {
      p.productVariants.forEach((v) => ids.add(v.id));
    });
    return ids;
  }, [products]);

  // Tri-state for select all button
  const allSelectionState = useMemo(() => {
    if (allVariantIds.size === 0) return "none";
    if (selectedVariantIds.size === 0) return "none";
    if (selectedVariantIds.size === allVariantIds.size) return "all";
    return "partial";
  }, [allVariantIds, selectedVariantIds]);

  const handleSelectAll = () => {
    if (allSelectionState === "all") {
      setSelectedVariantIds(new Set());
    } else {
      setSelectedVariantIds(new Set(allVariantIds));
    }
  };

  // Selected variants with product info for the right panel
  const selectedVariantsWithProduct = useMemo(() => {
    const result: { variant: Product["productVariants"][number]; product: Product }[] = [];
    products.forEach((product) => {
      product.productVariants.forEach((variant) => {
        if (selectedVariantIds.has(variant.id)) {
          result.push({ variant, product });
        }
      });
    });
    return result;
  }, [products, selectedVariantIds]);

  const toggleVariant = (variantId: string) => {
    const next = new Set(selectedVariantIds);
    if (next.has(variantId)) {
      next.delete(variantId);
    } else {
      next.add(variantId);
    }
    setSelectedVariantIds(next);
  };

  const toggleProduct = (product: Product) => {
    const allVariantIds = product.productVariants.map((v) => v.id);
    const allSelected = allVariantIds.every((id) => selectedVariantIds.has(id));

    const next = new Set(selectedVariantIds);
    if (allSelected) {
      for (const id of allVariantIds) next.delete(id);
    } else {
      for (const id of allVariantIds) next.add(id);
    }
    setSelectedVariantIds(next);
  };

  const handleApply = () => {
    onApply?.(Array.from(selectedVariantIds));
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedVariantIds(new Set());
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className={className} variant="outline">
          Filter By Product
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className={cn(
          "w-full transition-all duration-300 flex flex-col overflow-hidden p-0",
          selectedVariantIds.size > 0 ? "sm:max-w-4xl" : "sm:max-w-xl"
        )}
      >
        <SheetHeader className="p-6 pb-2 shrink-0">
          <SheetTitle>Select products</SheetTitle>
          <SheetDescription>Select products and variants to filter from the queue.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 h-full flex-row-reverse overflow-hidden">
          {/* Left panel: Product list */}
          <div className="flex-1 flex flex-col min-w-0 border-r">
            <div className="px-4 py-3 h-18 space-y-3 border-b shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  onClick={handleSelectAll}
                  variant={allSelectionState === "all" ? "default" : "outline"}
                  className="shrink-0"
                  disabled={allVariantIds.size === 0}
                >
                  {allSelectionState === "partial" && <Icon icon="ph:minus-bold" className="size-3 mr-1" />}
                  {allSelectionState === "all" && <Icon icon="ph:check-bold" className="size-3 mr-1" />}
                  Select All
                </Button>
                <Button
                  onClick={handleSelectStocked}
                  variant={stockedSelectionState === "all" ? "default" : "outline"}
                  className="shrink-0"
                  disabled={stockedVariantIds.size === 0}
                >
                  {stockedSelectionState === "partial" && (
                    <Icon icon="ph:minus-bold" className="size-3 mr-1" />
                  )}
                  {stockedSelectionState === "all" && <Icon icon="ph:check-bold" className="size-3 mr-1" />}
                  Stocked
                  {stockedVariantIds.size > 0 && (
                    <span className="ml-1 text-xs opacity-70">({stockedVariantIds.size})</span>
                  )}
                </Button>
              </div>
            </div>

            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No products found.</div>
              ) : (
                <div className="flex flex-col">
                  {filteredProducts.map((product) => {
                    const allVariantIds = product.productVariants.map((v) => v.id);
                    const selectedCount = allVariantIds.filter((id) => selectedVariantIds.has(id)).length;
                    const isAllSelected =
                      product.productVariants.length > 0 && selectedCount === product.productVariants.length;
                    const isIndeterminate = selectedCount > 0 && selectedCount < product.productVariants.length;

                    return (
                      <div key={product.id} className="flex flex-col border-b last:border-0">
                        {/* Product Header Row */}
                        <div className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
                          <Checkbox
                            checked={isAllSelected || (isIndeterminate ? "indeterminate" : false)}
                            onCheckedChange={() => toggleProduct(product)}
                          />
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-sm truncate">{product.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {product.isBlackLabel && (
                              <Badge className="bg-violet-50 text-violet-700">Black Label</Badge>
                            )}
                            <ProductStatusBadge status={product.status} />
                          </div>
                        </div>

                        {/* Variants Rows */}
                        {product.productVariants.map((variant) => {
                          const isSelected = selectedVariantIds.has(variant.id);
                          const hasStock = variant.warehouseInventory > 0;
                          return (
                            <div
                              key={variant.id}
                              className="grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-2 items-center border-t border-dashed bg-muted/5 hover:bg-muted/10"
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleVariant(variant.id)}
                                className="ml-6"
                              />
                              <div className="text-sm truncate">{variant.title}</div>
                              <div className="text-right text-sm w-16 text-muted-foreground shrink-0">
                                {product.isBlackLabel ? (
                                  <Badge className="bg-violet-50 text-violet-700">--</Badge>
                                ) : (
                                  <span className={cn(hasStock && "text-green-600 font-medium")}>
                                    {variant.warehouseInventory}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="h-48"></div>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right panel: Selected variants */}
          {selectedVariantIds.size > 0 && (
            <div className="w-80 flex flex-col bg-zinc-50">
              <div className="px-4 py-3 min-h-18! border-b flex items-center justify-between">
                <span className="font-medium text-sm">{selectedVariantIds.size} selected</span>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  Clear all
                </Button>
              </div>
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {selectedVariantsWithProduct.toSorted((a, b) => a.product.title.localeCompare(b.product.title)).map(({ variant, product }) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between p-2 rounded-md bg-white border text-sm group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-xs">{product.title}</div>
                        <div className="truncate text-muted-foreground text-xs">{variant.title}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                        onClick={() => toggleVariant(variant.id)}
                      >
                        <Icon icon="ph:x" className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="h-48"></div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white flex items-center justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
