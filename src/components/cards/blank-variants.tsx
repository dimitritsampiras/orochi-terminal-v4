"use client";

import { blankVariants, garmentSize } from "@drizzle/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpdateBlankVariantInput } from "@/components/forms/blank-forms/update-blank-variant-input";
import { colorNameToHex } from "@/lib/core/products/color-name-to-hex";
import { useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BulkUpdateBlankVariantsSchema,
  CreateBlankVariantSchema,
  GARMENT_SIZES,
} from "@/lib/schemas/product-schema";
import { cn, sleep } from "@/lib/utils";
import { toast } from "sonner";

type BlankVariant = typeof blankVariants.$inferSelect;
type GarmentSize = (typeof garmentSize.enumValues)[number];

const SIZE_ORDER: GarmentSize[] = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "os",
];

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

export function BlankVariantsTable({
  blankId,
  variants,
}: {
  blankId: string;
  variants: BlankVariant[];
}) {
  const router = useRouter();

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
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Variants</CardTitle>
          <CardDescription>
            {variants.length} variants across {colorStats.size} colors •{" "}
            {totalQuantity} total in stock
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <AddVariantDialog
            blankId={blankId}
            existingVariants={variants}
            onSuccess={async () => {
              router.refresh();
              await sleep(1000);
              toast.success("Variant added");
            }}
          />
          <AddColorDialog
            blankId={blankId}
            existingVariants={variants}
            onSuccess={async () => {
              router.refresh();
              await sleep(1000);
              toast.success("Color added");
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasGaps && (
          <Alert
            variant="default"
            className="bg-amber-50 border-amber-200 text-amber-800"
          >
            <Icon icon="ph:warning" className="h-4 w-4 text-amber-600" />
            <AlertTitle>Missing Variants Detected</AlertTitle>
            <AlertDescription>
              {Array.from(sizeGaps.entries()).map(([color, sizes]) => (
                <div key={color}>
                  <span className="font-medium">{color}:</span> missing{" "}
                  {sizes.map((s) => s.toUpperCase()).join(", ")}
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
              <TableHead className="text-right">
                <div className="flex flex-col items-end gap-1">
                  <span>Weight (oz)</span>
                  <BulkUpdateInput
                    blankId={blankId}
                    field="weight"
                    placeholder="Set all"
                  />
                </div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex flex-col items-end gap-1">
                  <span>Volume</span>
                  <BulkUpdateInput
                    blankId={blankId}
                    field="volume"
                    placeholder="Set all"
                  />
                </div>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVariants.map((variant) => (
              <VariantRow
                key={variant.id}
                blankId={blankId}
                variant={variant}
                onDelete={() => router.refresh()}
              />
            ))}
            {variants.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
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

// ============================================================================
// VariantRow Component
// ============================================================================

function VariantRow({
  blankId,
  variant,
  onDelete,
}: {
  blankId: string;
  variant: BlankVariant;
  onDelete: () => void;
}) {
  return (
    <TableRow>
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
          className="max-w-20 w-full"
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
      <TableCell className="text-right">
        <DeleteVariantDialog
          blankId={blankId}
          variant={variant}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// BulkUpdateInput Component
// ============================================================================

function BulkUpdateInput({
  blankId,
  field,
  placeholder,
}: {
  blankId: string;
  field: "weight" | "volume";
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const isSubmittingRef = useRef(false);
  const router = useRouter();

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: BulkUpdateBlankVariantsSchema) => {
      const res = await fetch(`/api/blanks/${blankId}/blank-variants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: async () => {
      router.refresh();
      await sleep(1000);
      toast.success(`All ${field} values updated`);
      setInputValue("");
      isSubmittingRef.current = false;
    },
    onError: () => {
      toast.error(`Failed to update ${field} values`);
      isSubmittingRef.current = false;
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue) {
      isSubmittingRef.current = true;
      handleSubmit();
      e.currentTarget.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || /^-?\d*\.?\d*$/.test(raw)) {
      setInputValue(raw);
    }
  };

  const handleBlur = () => {
    if (!isSubmittingRef.current) {
      setInputValue("");
    }
  };

  const handleSubmit = () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue) || numValue < 0) return;
    mutate({ [field]: numValue });
  };

  return (
    <Input
      className="max-w-20! my-2 h-9 text-xs text-right font-normal"
      placeholder={placeholder}
      value={inputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={isPending}
    />
  );
}

// ============================================================================
// DeleteVariantDialog Component
// ============================================================================

function DeleteVariantDialog({
  blankId,
  variant,
  onDelete,
}: {
  blankId: string;
  variant: BlankVariant;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const { trigger, isLoading } = useFetcher({
    path: `/api/blanks/${blankId}/blank-variants/${variant.id}`,
    method: "DELETE",
    successMessage: "Variant deleted",
    onSuccess: () => {
      setOpen(false);
      onDelete();
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-red-400 hover:text-red-600"
        >
          <Icon icon="ph:trash" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Variant</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the{" "}
            <span className="font-semibold">
              {variant.color} / {variant.size.toUpperCase()}
            </span>{" "}
            variant? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              className="bg-red-600! hover:bg-red-700!"
              loading={isLoading}
              onClick={(e) => {
                e.preventDefault();
                trigger(null);
              }}
            >
              Delete
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// AddVariantDialog Component
// ============================================================================

function AddVariantDialog({
  blankId,
  existingVariants,
  onSuccess,
}: {
  blankId: string;
  existingVariants: BlankVariant[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState("");
  const [size, setSize] = useState<GarmentSize | "">("");
  const [weight, setWeight] = useState("16");
  const [volume, setVolume] = useState("500");

  const { trigger, isLoading } = useFetcher<CreateBlankVariantSchema>({
    path: `/api/blanks/${blankId}/blank-variants`,
    method: "POST",
    successMessage: "Variant added",
    onSuccess: () => {
      setOpen(false);
      resetForm();
      onSuccess();
    },
  });

  // Get existing colors for quick-select
  const existingColors = useMemo(() => {
    return Array.from(new Set(existingVariants.map((v) => v.color))).sort();
  }, [existingVariants]);

  // Get sizes already taken for the current color (case-insensitive match)
  const takenSizesForColor = useMemo(() => {
    const normalizedColor = color.toLowerCase().trim();
    return new Set(
      existingVariants
        .filter((v) => v.color.toLowerCase() === normalizedColor)
        .map((v) => v.size)
    );
  }, [existingVariants, color]);

  const resetForm = () => {
    setColor("");
    setSize("");
    setWeight("16");
    setVolume("500");
  };

  const handleSubmit = () => {
    if (!color || !size) return;
    trigger({
      color,
      size,
      weight: parseFloat(weight) || 0,
      volume: parseFloat(volume) || 0,
      quantity: 0,
    });
  };

  const isDuplicate = size !== "" && takenSizesForColor.has(size);
  const isValid = color.length > 0 && size !== "" && !isDuplicate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon icon="ph:plus" />
          Add Variant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Variant</DialogTitle>
          <DialogDescription>
            Add a new color and size variant to this blank.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Color Input */}
          <div className="grid gap-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              placeholder="e.g. Black, White, Navy"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            {existingColors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {existingColors.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setColor(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Size Select */}
          <div className="grid gap-2">
            <Label htmlFor="size">Size</Label>
            <Select
              value={size}
              onValueChange={(v) => setSize(v as GarmentSize)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {SIZE_ORDER.map((s) => {
                  const isTaken = takenSizesForColor.has(s);
                  return (
                    <SelectItem key={s} value={s} disabled={isTaken}>
                      {s.toUpperCase()} {isTaken && "(exists)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {isDuplicate && (
              <p className="text-sm text-red-500">
                This color/size combination already exists.
              </p>
            )}
          </div>

          {/* Weight & Volume */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="weight">Weight (oz)</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="volume">Volume</Label>
              <Input
                id="volume"
                type="number"
                min="0"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            loading={isLoading}
          >
            Add Variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// AddColorDialog Component
// ============================================================================

function AddColorDialog({
  blankId,
  existingVariants,
  onSuccess,
}: {
  blankId: string;
  existingVariants: BlankVariant[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState("");
  const [weight, setWeight] = useState("16");
  const [volume, setVolume] = useState("500");
  const [selectedSizes, setSelectedSizes] = useState<GarmentSize[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Determine if existing variants use "os" or standard sizes
  const existingSizes = useMemo(() => {
    return Array.from(new Set(existingVariants.map((v) => v.size)));
  }, [existingVariants]);

  const isOsOnly =
    existingSizes.length > 0 && existingSizes.every((s) => s === "os");
  const isStandardOnly =
    existingSizes.length > 0 && existingSizes.every((s) => s !== "os");

  // Get default weight and volume from existing variants
  const defaultWeight = useMemo(() => {
    if (existingVariants.length === 0) return "16";
    return String(existingVariants[0].weight);
  }, [existingVariants]);

  const defaultVolume = useMemo(() => {
    if (existingVariants.length === 0) return "500";
    return String(existingVariants[0].volume);
  }, [existingVariants]);

  // Get existing colors to prevent duplicates
  const existingColors = useMemo(() => {
    return new Set(existingVariants.map((v) => v.color.toLowerCase()));
  }, [existingVariants]);

  const resetForm = () => {
    setColor("");
    setWeight(defaultWeight);
    setVolume(defaultVolume);
    // Default to existing sizes
    setSelectedSizes(
      existingSizes.length > 0 ? existingSizes : ["sm", "md", "lg", "xl", "2xl"]
    );
  };

  // Initialize form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      resetForm();
    }
  };

  const handleSizeClick = (size: GarmentSize) => {
    if (size === "os") {
      // If clicking "os", only allow if no standard sizes exist or it's a new blank
      if (isStandardOnly) return;
      setSelectedSizes(["os"]);
      return;
    }

    // If clicking a standard size, only allow if no "os" exists or it's a new blank
    if (isOsOnly) return;

    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== size && s !== "os"));
    } else {
      setSelectedSizes(
        [...selectedSizes.filter((s) => s !== "os"), size].sort(
          (a, b) => GARMENT_SIZES.indexOf(a) - GARMENT_SIZES.indexOf(b)
        )
      );
    }
  };

  const handleSubmit = async () => {
    if (!color || selectedSizes.length === 0) return;

    setIsLoading(true);
    try {
      // Create all variants for the new color
      const promises = selectedSizes.map((size) =>
        fetch(`/api/blanks/${blankId}/blank-variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            color,
            size,
            weight: parseFloat(weight) || 0,
            volume: parseFloat(volume) || 0,
            quantity: 0,
          } satisfies CreateBlankVariantSchema),
        })
      );

      await Promise.all(promises);
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error) {
      console.error("Failed to create color variants:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isDuplicate = existingColors.has(color.toLowerCase().trim());
  const isValid = color.length > 0 && selectedSizes.length > 0 && !isDuplicate;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon icon="ph:palette" />
          Add Color
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Color</DialogTitle>
          <DialogDescription>
            Add a new color with all its size variants.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Color Input */}
          <div className="grid gap-2">
            <Label htmlFor="add-color">Color Name</Label>
            <Input
              id="add-color"
              placeholder="e.g. Black, White, Navy"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            {isDuplicate && (
              <p className="text-sm text-red-500">This color already exists.</p>
            )}
          </div>

          {/* Sizes */}
          <div className="grid gap-2">
            <Label>Sizes</Label>
            <div className="flex flex-wrap gap-2">
              {GARMENT_SIZES.map((size) => {
                const isDisabled =
                  (size === "os" && isStandardOnly) ||
                  (size !== "os" && isOsOnly);
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSizeClick(size)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md border bg-zinc-50 text-xs text-zinc-600 transition uppercase font-medium hover:bg-zinc-100",
                      selectedSizes.includes(size) &&
                        "bg-zinc-900 text-white hover:bg-zinc-800",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedSizes.length} size{selectedSizes.length !== 1 && "s"}{" "}
              selected
              {(isOsOnly || isStandardOnly) && (
                <span className="ml-1">
                  (
                  {isOsOnly
                    ? "OS only - existing variants use OS"
                    : "Standard sizes only"}
                  )
                </span>
              )}
            </p>
          </div>

          {/* Weight & Volume */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="add-color-weight">Weight (oz)</Label>
              <Input
                id="add-color-weight"
                type="number"
                min="0"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-color-volume">Volume</Label>
              <Input
                id="add-color-volume"
                type="number"
                min="0"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            loading={isLoading}
          >
            Add Color
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
