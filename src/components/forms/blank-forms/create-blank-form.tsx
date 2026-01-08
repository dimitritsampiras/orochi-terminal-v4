"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import {
  CreateBlankSchema,
  GARMENT_SIZES,
  GARMENT_TYPES,
} from "@/lib/schemas/product-schema";
import { CreateBlankResponse } from "@/lib/types/api";

type GarmentSize = (typeof GARMENT_SIZES)[number];
type GarmentType = (typeof GARMENT_TYPES)[number];

export const CreateBlankForm = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Form state
  const [blankName, setBlankName] = useState("");
  const [blankCompany, setBlankCompany] = useState("");
  const [garmentType, setGarmentType] = useState<GarmentType>("tee");
  const [firstColor, setFirstColor] = useState("");
  const [customsPrice, setCustomsPrice] = useState<number>(0);
  const [selectedSizes, setSelectedSizes] = useState<GarmentSize[]>([
    "xs",
    "sm",
    "md",
    "lg",
    "xl",
    "2xl",
    "3xl",
  ]);

  const { trigger: createBlank, isLoading } = useFetcher<
    CreateBlankSchema,
    CreateBlankResponse
  >({
    path: "/api/blanks",
    method: "POST",
    successMessage: "Blank created successfully",
    errorMessage: "Failed to create blank",
    onSuccess: ({ data }) => {
      if (data) {
        setOpen(false);
        router.push(`/inventory/${data.id}`);
      }
    },
  });

  const handleSizeClick = (size: GarmentSize) => {
    if (size === "os") {
      setSelectedSizes(["os"]);
      return;
    }

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

  const resetForm = () => {
    setBlankName("");
    setBlankCompany("");
    setGarmentType("tee");
    setFirstColor("");
    setCustomsPrice(0);
    setSelectedSizes(["xs", "sm", "md", "lg", "xl", "2xl", "3xl"]);
  };

  const handleSubmit = async () => {
    if (!blankName || !blankCompany || !firstColor || selectedSizes.length === 0) {
      return;
    }

    await createBlank({
      blankName,
      blankCompany,
      garmentType,
      firstColor,
      customsPrice,
      sizes: selectedSizes,
    });
  };

  const isFormValid =
    blankName.length > 0 &&
    blankCompany.length > 0 &&
    firstColor.length > 0 &&
    selectedSizes.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <SheetTrigger asChild>
        <Button>
          <Icon icon="ph:plus-circle" />
          Add New Blank
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add New Blank</SheetTitle>
          <SheetDescription>
            Add a new blank to the database with its initial color and sizes.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col h-full">
          <ScrollArea className="h-full">
            <div className="space-y-4 px-4">
              {/* Blank Name */}
              <div className="space-y-2">
                <Label htmlFor="blankName">Blank Name</Label>
                <Input
                  id="blankName"
                  placeholder="(ss4500, h000, etc.)"
                  value={blankName}
                  onChange={(e) => setBlankName(e.target.value)}
                />
              </div>

              {/* Blank Company */}
              <div className="space-y-2">
                <Label htmlFor="blankCompany">Blank Company</Label>
                <Input
                  id="blankCompany"
                  placeholder="(gildan, comfort colors, etc.)"
                  value={blankCompany}
                  onChange={(e) => setBlankCompany(e.target.value)}
                />
              </div>

              {/* First Color */}
              <div className="space-y-2">
                <Label htmlFor="firstColor">First Color</Label>
                <Input
                  id="firstColor"
                  placeholder="First color to create"
                  value={firstColor}
                  onChange={(e) => setFirstColor(e.target.value)}
                />
              </div>

              {/* Customs Price */}
              <div className="space-y-2">
                <Label htmlFor="customsPrice">Customs Price ($)</Label>
                <Input
                  id="customsPrice"
                  type="number"
                  placeholder="Average price of blank"
                  value={customsPrice || ""}
                  onChange={(e) =>
                    setCustomsPrice(
                      e.target.value === "" ? 0 : Number(e.target.value)
                    )
                  }
                  min={0}
                  step={0.01}
                />
              </div>

              {/* Garment Type */}
              <div className="space-y-2">
                <Label>Garment Type</Label>
                <Select
                  value={garmentType}
                  onValueChange={(value) => setGarmentType(value as GarmentType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select garment type" />
                  </SelectTrigger>
                  <SelectContent>
                    {GARMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sizes */}
              <div className="space-y-2">
                <Label>Sizes</Label>
                <div className="flex flex-wrap gap-2">
                  {GARMENT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleSizeClick(size)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md border bg-zinc-50 text-xs text-zinc-600 transition uppercase font-medium hover:bg-zinc-100",
                        selectedSizes.includes(size) &&
                          "bg-zinc-900 text-white hover:bg-zinc-800"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedSizes.length} size{selectedSizes.length !== 1 && "s"}{" "}
                  selected
                </p>
              </div>
            </div>
            <div className="h-[200px]"></div>
          </ScrollArea>
        </div>

        <SheetFooter className="border-t absolute bottom-0 left-0 right-0 bg-white">
          <Button
            disabled={!isFormValid}
            loading={isLoading}
            onClick={handleSubmit}
          >
            Add Blank
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

