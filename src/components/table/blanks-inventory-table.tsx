"use client";

import { blanks, blankVariants, garmentSize, garmentType } from "@drizzle/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpdateBlankQuantityForm } from "@/components/forms/blank-forms/update-blank-quantity-form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Icon } from "@iconify/react";
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "../ui/button";

type Blank = typeof blanks.$inferSelect & {
  blankVariants: (typeof blankVariants.$inferSelect)[];
};

type GarmentType = (typeof garmentType.enumValues)[number];
type GarmentSize = (typeof garmentSize.enumValues)[number];

const GARMENT_TABS: (GarmentType | "other")[] = [
  "hoodie",
  "crewneck",
  "longsleeve",
  "tee",
  "shorts",
  "sweatpants",
  "headwear",
  "accessory",
  "other",
];

const SIZES: GarmentSize[] = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];

export function BlanksInventoryTable({ blanks }: { blanks: Blank[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get garmentType from URL, default to "hoodie"
  const selectedTab = searchParams.get("garmentType") || "hoodie";

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("garmentType", value);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // Filter blanks by selected garment type
  const filteredBlanks = useMemo(() => {
    if (selectedTab === "other") {
      return blanks.filter((b) => !GARMENT_TABS.includes(b.garmentType));
    }
    return blanks.filter((b) => b.garmentType === selectedTab);
  }, [blanks, selectedTab]);

  return (
    <Tabs value={selectedTab} onValueChange={handleTabChange} className="mt-4">
      <div className="w-full overflow-y-scroll flex items-center px-2 rounded-full h-12 bg-zinc-100">
        <TabsList>
          {GARMENT_TABS.map((type) => (
            <TabsTrigger key={type} value={type} className="capitalize">
              {type}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {GARMENT_TABS.map((type) => (
        <TabsContent key={type} value={type} className="space-y-4">
          {filteredBlanks.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-8">No blanks found for this garment type.</div>
          ) : (
            filteredBlanks.map((blank) => <BlankInventoryCard key={blank.id} blank={blank} />)
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * For a given color, determines which sizes are "expected" (within the min-max range).
 * Returns a set of sizes that should exist for this color.
 */
function getExpectedSizesForColor(variants: (typeof blankVariants.$inferSelect)[], color: string): Set<GarmentSize> {
  const colorVariants = variants.filter((v) => v.color === color);
  const presentIndices = colorVariants
    .map((v) => SIZES.indexOf(v.size))
    .filter((i) => i !== -1)
    .sort((a, b) => a - b);

  if (presentIndices.length < 2) {
    // Only one size present, no range to check
    return new Set(colorVariants.map((v) => v.size));
  }

  const minIdx = presentIndices[0];
  const maxIdx = presentIndices[presentIndices.length - 1];

  // All sizes between min and max are "expected"
  const expected = new Set<GarmentSize>();
  for (let i = minIdx; i <= maxIdx; i++) {
    expected.add(SIZES[i]);
  }

  return expected;
}

function BlankInventoryCard({ blank }: { blank: Blank }) {
  // Create a lookup map: "color@size" -> variant
  const variantMap = useMemo(() => {
    const map = new Map<string, (typeof blank.blankVariants)[number]>();
    for (const variant of blank.blankVariants) {
      const key = `${variant.color}@${variant.size}`;
      map.set(key, variant);
    }
    return map;
  }, [blank.blankVariants]);

  // Get unique colors, sorted
  const colors = useMemo(() => {
    const colorSet = new Set(blank.blankVariants.map((v) => v.color));
    return Array.from(colorSet).sort((a, b) => a.localeCompare(b));
  }, [blank.blankVariants]);

  // Precompute expected sizes for each color
  const expectedSizesMap = useMemo(() => {
    const map = new Map<string, Set<GarmentSize>>();
    for (const color of colors) {
      map.set(color, getExpectedSizesForColor(blank.blankVariants, color));
    }
    return map;
  }, [blank.blankVariants, colors]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <CardTitle className="capitalize">
            {blank.blankCompany} {blank.blankName}
          </CardTitle>
          <div className="text-sm text-muted-foreground capitalize">{blank.garmentType}</div>
        </div>
        <Link href={`/inventory/${blank.id}`} className={buttonVariants({ variant: "fill", size: "icon" })}>
          <Icon icon="ph:pencil" />
        </Link>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Color</TableHead>
              {SIZES.map((size) => (
                <TableHead key={size} className="text-right uppercase">
                  {size}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {colors.map((color) => {
              const expectedSizes = expectedSizesMap.get(color) || new Set();

              return (
                <TableRow key={color}>
                  <TableCell className="font-medium">{color}</TableCell>
                  {SIZES.map((size) => {
                    const key = `${color}@${size}`;
                    const variant = variantMap.get(key);
                    const isExpected = expectedSizes.has(size);

                    return (
                      <TableCell key={size}>
                        <div className="flex items-center justify-end h-full w-full">
                          {variant ? (
                            <UpdateBlankQuantityForm
                              blankId={blank.id}
                              blankVariantId={variant.id}
                              currentQuantity={variant.quantity}
                            />
                          ) : isExpected ? (
                            // Missing variant within expected range - show warning
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="h-8 bg-amber-50 text-amber-600 cursor-help rounded-md w-16 flex items-center justify-center">
                                    <Icon icon="ph:warning" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-center text-xs">
                                    Missing variant: {color} / {size.toUpperCase()}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            // Size outside expected range - just show minus
                            <div className="h-8 text-zinc-300 rounded-md w-16 flex items-center justify-center">
                              <Icon icon="ph:minus" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
            {colors.length === 0 && (
              <TableRow>
                <TableCell colSpan={SIZES.length + 1} className="text-center text-muted-foreground">
                  No variants found for this blank.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
