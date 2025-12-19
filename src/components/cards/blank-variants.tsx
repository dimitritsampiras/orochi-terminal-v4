"use client";

import { blankVariants, garmentSize } from "@drizzle/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UpdateBlankVariantInput } from "@/components/forms/blank-forms/update-blank-variant-input";
import { colorNameToHex } from "@/lib/core/products/color-name-to-hex";
import { useMemo } from "react";
import { Icon } from "@iconify/react";

type BlankVariant = typeof blankVariants.$inferSelect;
type GarmentSize = (typeof garmentSize.enumValues)[number];

const SIZE_ORDER: GarmentSize[] = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "os"];

/**
 * Detects gaps in size ranges for each color.
 * A gap exists when there's a missing size between the min and max sizes present.
 * e.g., if sm, md, lg, xl, 5xl exist, then 2xl, 3xl, 4xl are gaps.
 */
function detectSizeGaps(variants: BlankVariant[]): Map<string, GarmentSize[]> {
  const colorSizes = new Map<string, Set<GarmentSize>>();

  // Group sizes by color
  for (const v of variants) {
    const sizes = colorSizes.get(v.color) || new Set();
    sizes.add(v.size);
    colorSizes.set(v.color, sizes);
  }

  const gaps = new Map<string, GarmentSize[]>();

  for (const [color, sizes] of colorSizes) {
    // Get indices of present sizes (excluding 'os' which is standalone)
    const presentIndices = Array.from(sizes)
      .filter((s) => s !== "os")
      .map((s) => SIZE_ORDER.indexOf(s))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);

    if (presentIndices.length < 2) continue;

    const minIdx = presentIndices[0];
    const maxIdx = presentIndices[presentIndices.length - 1];

    // Find missing sizes between min and max
    const missingSizes: GarmentSize[] = [];
    for (let i = minIdx; i <= maxIdx; i++) {
      const size = SIZE_ORDER[i];
      if (!sizes.has(size)) {
        missingSizes.push(size);
      }
    }

    if (missingSizes.length > 0) {
      gaps.set(color, missingSizes);
    }
  }

  return gaps;
}

export function BlankVariantsTable({ blankId, variants }: { blankId: string; variants: BlankVariant[] }) {
  // Sort variants by color, then by size order
  const sortedVariants = useMemo(() => {
    return [...variants].sort((a, b) => {
      const colorCompare = a.color.localeCompare(b.color);
      if (colorCompare !== 0) return colorCompare;
      return SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size);
    });
  }, [variants]);

  // Group by color for summary stats
  const colorStats = useMemo(() => {
    const stats = new Map<string, { count: number; totalQuantity: number }>();
    for (const v of variants) {
      const existing = stats.get(v.color) || { count: 0, totalQuantity: 0 };
      stats.set(v.color, {
        count: existing.count + 1,
        totalQuantity: existing.totalQuantity + v.quantity,
      });
    }
    return stats;
  }, [variants]);

  // Detect size gaps
  const sizeGaps = useMemo(() => detectSizeGaps(variants), [variants]);

  const totalQuantity = variants.reduce((acc, v) => acc + v.quantity, 0);
  const hasGaps = sizeGaps.size > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Variants</CardTitle>
        <CardDescription>
          {variants.length} variants across {colorStats.size} colors • {totalQuantity} total in stock
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasGaps && (
          <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-800">
            <Icon icon="ph:warning" className="h-4 w-4 text-amber-600" />
            <AlertTitle >Missing Variants Detected</AlertTitle>
            <AlertDescription>
              {Array.from(sizeGaps.entries()).map(([color, sizes]) => (
                <div key={color}>
                  <span className="font-medium">{color}:</span> missing {sizes.map((s) => s.toUpperCase()).join(", ")}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Color</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Weight (oz)</TableHead>
              <TableHead className="text-right">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVariants.map((variant) => (
              <TableRow key={variant.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border border-zinc-300"
                      style={{ backgroundColor: colorNameToHex(variant.color) }}
                    />
                    <span className="font-medium">{variant.color}</span>
                  </div>
                </TableCell>
                <TableCell className="uppercase text-sm">{variant.size}</TableCell>
                <TableCell className="text-right">
                  <UpdateBlankVariantInput
                    blankId={blankId}
                    blankVariantId={variant.id}
                    field="quantity"
                    currentValue={variant.quantity}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <UpdateBlankVariantInput
                    blankId={blankId}
                    blankVariantId={variant.id}
                    field="weight"
                    currentValue={variant.weight}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <UpdateBlankVariantInput
                    blankId={blankId}
                    blankVariantId={variant.id}
                    field="volume"
                    currentValue={variant.volume}
                  />
                </TableCell>
              </TableRow>
            ))}
            {variants.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No variants found. Add colors and sizes to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
