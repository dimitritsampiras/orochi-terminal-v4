"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { ProductStatusBadge } from "@/components/badges/product-status-badge";
import { cn } from "@/lib/utils";
import { GetProductsResponse } from "@/lib/types/api";
import { Badge } from "../ui/badge";

interface FilterProductsFromQueueDialogProps {
  className?: string;
  onApply?: (selectedVariantIds: string[]) => void;
}

type Product = NonNullable<GetProductsResponse["data"]>[number];

export function FilterProductsFromQueueDialog({ className, onApply }: FilterProductsFromQueueDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());

  // Debounce search query
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

  // Reset when dialog opens or query changes
  useEffect(() => {
    if (open) {
      setPage(1);
      setProducts([]);
      setHasMore(true);
    }
  }, [open, debouncedQuery]);

  // Fetch products
  useEffect(() => {
    if (!open || !hasMore) return;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        if (debouncedQuery) params.set("q", debouncedQuery);

        const res = await fetch(`/api/products?${params.toString()}`);
        const json = (await res.json()) as GetProductsResponse;

        if (json.data) {
          setProducts((prev) => {
            if (page === 1) return json.data;
            // Append new products, avoiding duplicates just in case
            const existingIds = new Set(prev.map((p) => p.id));
            const newProducts = json.data.filter((p: Product) => !existingIds.has(p.id));
            return [...prev, ...newProducts];
          });
          if (json.data.length === 0) {
            setHasMore(false);
          }
        } else {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Failed to fetch products", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [open, page, debouncedQuery]);

  // Infinite scroll observer
  const observerTarget = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

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
    const allVariantIds = product.variants.map((v) => v.id);
    const allSelected = allVariantIds.every((id) => selectedVariantIds.has(id));

    const next = new Set(selectedVariantIds);
    if (allSelected) {
      // Deselect all
      for (const id of allVariantIds) next.delete(id);
    } else {
      // Select all
      for (const id of allVariantIds) next.add(id);
    }
    setSelectedVariantIds(next);
  };

  const handleApply = () => {
    onApply?.(Array.from(selectedVariantIds));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={className} variant="outline">
          Filter Products
        </Button>
      </DialogTrigger>
      <DialogContent className=" overflow-clip sm:max-w-[600px] flex flex-col gap-0 p-0 h-[80vh] max-h-[80vh]">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>Select products</DialogTitle>
          <DialogDescription className="sr-only">
            Select products and variants to filter from the queue.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-2 space-y-4 border-b shrink-0">
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
            {/* Placeholder for "Search by All" or extra filters if needed */}
            <Button variant="outline" className="shrink-0">
              Add filter <Plus className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-3 text-xs font-medium text-muted-foreground border-b bg-white top-0 z-10">
          <div className="w-4" /> {/* Checkbox placeholder */}
          <div>Product</div>
          <div className="text-right w-20">Available</div>
          <div className="text-right w-20">Price</div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col">
            {products.map((product) => {
              const allVariantIds = product.variants.map((v) => v.id);
              const selectedCount = allVariantIds.filter((id) => selectedVariantIds.has(id)).length;
              const isAllSelected = product.variants.length > 0 && selectedCount === product.variants.length;
              const isIndeterminate = selectedCount > 0 && selectedCount < product.variants.length;

              return (
                <div key={product.id} className="flex flex-col border-b last:border-0">
                  {/* Product Header Row */}
                  <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors">
                    <Checkbox
                      checked={isAllSelected || (isIndeterminate ? "indeterminate" : false)}
                      onCheckedChange={() => toggleProduct(product)}
                      className="mt-1"
                    />
                    <div className="flex items-center gap-3">
                      {/* Image placeholder since we don't have images */}
                      <div className="h-10 w-10 rounded-md bg-muted border flex items-center justify-center text-xs text-muted-foreground shrink-0">
                        Img
                      </div>
                      <span className="font-medium text-sm">{product.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {product.isBlackLabel && <Badge className="bg-violet-50 text-violet-700">Black Label</Badge>}
                      <ProductStatusBadge status={product.status} />
                    </div>
                  </div>

                  {/* Variants Rows */}
                  {product.variants.map((variant) => {
                    const isSelected = selectedVariantIds.has(variant.id);
                    return (
                      <div
                        key={variant.id}
                        className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-3 items-center border-t border-dashed bg-muted/5 hover:bg-muted/10"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleVariant(variant.id)}
                          className="ml-8" // Indent checkbox
                        />
                        <div className="text-sm pl-2">{variant.title}</div>
                        <div className="text-right text-sm w-20 text-muted-foreground">
                          {product.isBlackLabel ? (
                            <Badge className="bg-violet-50 text-violet-700">--</Badge>
                          ) : (
                            variant.warehouseInventory
                          )}
                        </div>
                        <div className="text-right text-sm w-20 text-muted-foreground">{variant.price}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}

            {!loading && hasMore && <div ref={observerTarget} className="h-4 w-full" />}

            {!loading && products.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No products found.</div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-white flex items-center justify-between shrink-0">
          <div className="text-sm text-muted-foreground">{selectedVariantIds.size} variants selected</div>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleApply}>Apply</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
