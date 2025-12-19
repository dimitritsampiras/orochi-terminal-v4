"use client";

import { blankVariants, blanks, products } from "@drizzle/schema";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Icon } from "@iconify/react";
import { Button } from "../ui/button";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { SyncBlankSchema, UpdateProductSchema } from "@/lib/schemas/product-schema";
import { parseGid } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { GetBlanksResponse } from "@/lib/types/api";
import { useEffect, useMemo, useState } from "react";
import { Spinner } from "../ui/spinner";
import { colorNameToHex } from "@/lib/core/products/color-name-to-hex";

type SyncBlankToProductProps = {
  product: typeof products.$inferSelect & {
    blankVariants: (typeof blankVariants.$inferSelect)[];
  };
  blank: typeof blanks.$inferSelect | null | undefined;
};

export function SyncBlankToProduct({ product, blank }: SyncBlankToProductProps) {
  const { isLoading, trigger: triggerUpdateProduct } = useFetcher<UpdateProductSchema>({
    path: `/api/products/${parseGid(product.id)}`,
    method: "PATCH",
  });

  const { trigger: triggerDisconnect, isLoading: isDisconnecting } = useFetcher({
    path: `/api/products/${parseGid(product.id)}/sync`,
    method: "DELETE",
    successMessage: "Blank disconnected successfully",
  });

  // Assume the product is mono-color, so we take the color from the first linked blank variant
  const currentColor = product.blankVariants?.[0]?.color;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Blank to Product</CardTitle>
      </CardHeader>

      <CardContent>
        {!blank && !product.isBlackLabel && (
          <Alert variant="destructive">
            <Icon icon="ph:warning-circle" />
            <AlertTitle>No blank synced</AlertTitle>
            <AlertDescription>
              <p>Please sync a blank to the product or set as black label.</p>
            </AlertDescription>
          </Alert>
        )}
        {product.isBlackLabel && (
          <Alert variant="default" className="text-indigo-600">
            <Icon icon="ph:info" />
            <AlertTitle>Black label product</AlertTitle>
            <AlertDescription>
              <p>This product is a premade, "black label" product. It is not synced to a blank.</p>
            </AlertDescription>
          </Alert>
        )}
        {blank && (
          <div className="capitalize">
            <div>
              <span className="font-semibold">Blank:</span> {blank.blankCompany} {blank.blankName}
            </div>
            <div>
              <span className="font-semibold">Garment Type:</span> {blank.garmentType}
            </div>
            {currentColor && (
              <div>
                <span className="font-semibold">Synced Color:</span> {currentColor}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        {!blank && !product.isBlackLabel && (
          <div className="flex items-center flex-col gap-2 w-full">
            <SyncBlankDialog
              product={product}
              trigger={
                <Button variant="outline" className="w-full">
                  Sync Blank
                </Button>
              }
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                triggerUpdateProduct(
                  { isBlackLabel: true },
                  { successMessage: "Product set to black label", errorMessage: "Failed to set product to black label" }
                )
              }
              loading={isLoading}
            >
              Set as Black Label
            </Button>
          </div>
        )}

        {product.isBlackLabel && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              triggerUpdateProduct(
                { isBlackLabel: false },
                {
                  successMessage: "Black label status removed",
                  errorMessage: "Failed to remove black label status",
                }
              )
            }
            loading={isLoading}
          >
            <Icon icon="ph:link-break" className="text-indigo-600" />
            Remove Black Label Status
          </Button>
        )}
        {blank && (
          <div className="flex flex-col items-center gap-2 w-full">
            <SyncBlankDialog
              product={product}
              defaultBlankId={blank.id}
              defaultColor={currentColor}
              trigger={
                <Button variant="fill" className="w-full">
                  Update Blank
                </Button>
              }
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => triggerDisconnect(null)}
              loading={isDisconnecting}
            >
              <Icon icon="ph:link-break" className="text-red-600" />
              Disconnect Blank
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

interface SyncBlankDialogProps {
  product: typeof products.$inferSelect;
  trigger: React.ReactNode;
  defaultBlankId?: string;
  defaultColor?: string;
}

const SyncBlankDialog = ({ product, trigger, defaultBlankId, defaultColor }: SyncBlankDialogProps) => {
  const [open, setOpen] = useState(false);
  const [blanks, setBlanks] = useState<GetBlanksResponse["data"]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBlankId, setSelectedBlankId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const { trigger: syncTrigger, isLoading: isSyncingBlank } = useFetcher<SyncBlankSchema>({
    path: `/api/products/${parseGid(product.id)}/sync`,
    method: "POST",
    successMessage: "Blank synced successfully",
  });

  const colorOptions = useMemo(() => {
    if (!selectedBlankId || !blanks) return [];
    const colors =
      blanks.find((blank) => blank.id === selectedBlankId)?.blankVariants.map((variant) => variant.color) || [];

    const uniqueColors = [...new Set(colors)];
    return uniqueColors;
  }, [blanks, selectedBlankId]);

  useEffect(() => {
    if (open) {
      // Reset or set defaults when opening
      if (defaultBlankId) setSelectedBlankId(defaultBlankId);
      if (defaultColor) setSelectedColor(defaultColor);

      const fetchBlanks = async () => {
        setLoading(true);
        try {
          const res = await fetch("/api/blanks");
          const json = (await res.json()) as GetBlanksResponse;
          if (json.data) {
            setBlanks(json.data);
          }
        } catch (error) {
          console.error("Failed to fetch blanks:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchBlanks();
    }
  }, [open, defaultBlankId, defaultColor]);

  const handleSelectBlank = (blankId: string) => {
    // If clicking the same blank, do nothing or deselect (optional, kept simple here)
    if (blankId === selectedBlankId) {
      // setSelectedBlankId(null); // Optional: allow deselect
      return;
    }
    setSelectedBlankId(blankId);
    setSelectedColor(null); // Reset color when blank changes
  };

  const handleSelectColor = (color: string) => {
    if (color === selectedColor) {
      // setSelectedColor(null); // Optional: allow deselect
      return;
    }
    setSelectedColor(color);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl!">
        <DialogHeader>
          <DialogTitle>{defaultBlankId ? "Update Synced Blank" : "Sync Blank"}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <div> Loading blanks</div> <Spinner className="block" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 min-h-[400px] overflow-y-scroll">
              <div className="space-y-2">
                <div className="font-semibold">Blank Options</div>
                <div className="flex gap-2 flex-wrap">
                  {blanks
                    ?.toSorted((a, b) => a.blankCompany.localeCompare(b.blankCompany))
                    .map((blank) => (
                      <Button
                        key={blank.id}
                        variant={blank.id === selectedBlankId ? "default" : "fill"}
                        className="p-2 border rounded-md text-sm capitalize"
                        onClick={() => handleSelectBlank(blank.id)}
                      >
                        <div className="font-semibold">
                          {blank.blankCompany} {blank.blankName}
                        </div>
                        <div className="text-xs text-muted-foreground">{blank.garmentType}</div>
                      </Button>
                    ))}
                  {blanks?.length === 0 && <div className="text-sm text-center">No blanks found</div>}
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold">Color Options</div>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions
                    ?.toSorted((a, b) => b.localeCompare(a))
                    .map((color) => (
                      <Button
                        key={color}
                        size="sm"
                        variant={color === selectedColor ? "default" : "fill"}
                        className="p-2 border rounded-md text-xs capitalize"
                        onClick={() => handleSelectColor(color)}
                      >
                        <div
                          className="min-w-3 min-h-3 rounded-full border"
                          style={{ backgroundColor: colorNameToHex(color) }}
                        ></div>
                        <div className="font-semibold">{color}</div>
                      </Button>
                    ))}
                  {colorOptions?.length === 0 && (
                    <div className="text-sm text-center text-muted-foreground">
                      {selectedBlankId
                        ? "No color options found for this blank."
                        : "Select a blank to see colors."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedBlankId || !selectedColor}
            onClick={async () => {
              if (!selectedBlankId || !selectedColor) return;
              await syncTrigger({ blank_id: selectedBlankId, color: selectedColor });
              setOpen(false); // Close dialog on trigger
            }}
            loading={isSyncingBlank}
          >
            {defaultBlankId ? "Update Blank" : "Sync Blank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};