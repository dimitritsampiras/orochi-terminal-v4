import { ProductQuery } from "@/lib/types/admin.generated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { blanks, blankVariants, prints, products, productVariants } from "@drizzle/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { ProductSyncStatusBadge } from "../badges/product-sync-status-badge";
import { UpdateOverstockForm } from "../forms/product-forms/update-overstock-form";
import { Icon } from "@iconify/react";
import { PrintProductVariantForm } from "../forms/product-forms/print-product-variant-form";
import { useLocalServer } from "@/lib/hooks/use-local-server";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

type ProductVariant = NonNullable<NonNullable<ProductQuery["product"]>["variants"]>["nodes"][number];
type DatabaseVariant = typeof productVariants.$inferSelect;
type BlankVariant = typeof blankVariants.$inferSelect;
type Blank = typeof blanks.$inferSelect;
type Product = typeof products.$inferSelect;
type Print = typeof prints.$inferSelect;

export const ProductVariants = ({
  product,
  variants,
  prints,
  databaseVariants,
  productBlankVariants,
  blank,
}: {
  product: Product;
  variants: ProductVariant[];
  databaseVariants: DatabaseVariant[];
  productBlankVariants?: BlankVariant[] | undefined;
  blank?: Blank | undefined | null;
  prints: Print[];
}) => {
  // Organize the data first
  const organizedVariants = variants.map((variant) => {
    const databaseVariant = databaseVariants.find((v) => v.id === variant.id);

    // Find the blank variant linked to this product variant
    const linkedBlankVariant = databaseVariant?.blankVariantId
      ? productBlankVariants?.find((bv) => bv.id === databaseVariant.blankVariantId)
      : null;

    // Check if the found blank variant actually belongs to the loaded blank
    const isMismatch = linkedBlankVariant && blank && linkedBlankVariant.blankId !== blank.id;

    // Valid sync only if it matches current blank
    const syncedBlankVariant = !isMismatch ? linkedBlankVariant : null;
    const syncedBlank = syncedBlankVariant ? blank : null;

    return {
      ...variant,
      databaseVariant,
      syncedBlankVariant,
      syncedBlank,
      isMismatch,
      linkedBlankVariant,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variants</CardTitle>
        <CardDescription>Edit Variant Inventory & Print File</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Synced Blank</TableHead>
              <TableHead>Product Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizedVariants.map((variant) => (
              <TableRow key={variant.id}>
                <TableCell className="font-medium">{variant.title}</TableCell>
                <TableCell>
                  {product.isBlackLabel ? (
                    <ProductSyncStatusBadge status="black_label" isBlackLabel />
                  ) : variant.syncedBlank && variant.syncedBlankVariant ? (
                    <Link
                      href={`/inventory?garmentType=${blank?.garmentType}`}
                      className="flex flex-col hover:cursor-pointer hover:bg-zinc-200/50 rounded-md py-1 px-2 transition-all"
                    >
                      <span className="font-medium text-sm capitalize">
                        {variant.syncedBlankVariant.color} • {variant.syncedBlankVariant.size.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {variant.syncedBlank.blankCompany} {variant.syncedBlank.blankName}
                      </span>
                      <span className="text-xs">Blank Stock: {variant.syncedBlankVariant.quantity}</span>
                    </Link>
                  ) : variant.isMismatch ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-2 py-1 rounded-md w-fit cursor-help">
                            <Icon icon="ph:warning-circle" />
                            <span className="text-xs font-medium">Stale Link</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-center">
                            Linked to {variant.linkedBlankVariant?.size} {variant.linkedBlankVariant?.color} <br />
                            from a different blank.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : blank ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-2 py-1 rounded-md w-fit cursor-help">
                            <Icon icon="ph:warning" />
                            <span className="text-xs font-medium">Variant Missing</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-center">
                            Product is synced to {blank.blankCompany} {blank.blankName}, <br></br> but no matching blank
                            variant was found for this size/color.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <ProductSyncStatusBadge status="not_synced" />
                  )}
                </TableCell>
                <TableCell>
                  <UpdateOverstockForm
                    variantId={variant.id}
                    productId={product.id}
                    currentWarehouseInventory={variant.databaseVariant?.warehouseInventory ?? 0}
                    isBlackLabel={product.isBlackLabel}
                  />
                </TableCell>
                <TableCell className="text-right flex gap-2 items-center justify-end">
                  {/* <Button variant="outline" size="icon">
                    <Icon icon="ph:arrows-counter-clockwise" />
                  </Button> */}

                  <PrintProductVariantForm
                    productVariant={variant.databaseVariant}
                    blankVariant={variant.syncedBlankVariant}
                    blank={variant.syncedBlank}
                    product={product}
                    prints={prints}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const getFilePath = () => {};
