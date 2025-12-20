"use client";

import { blanks, garmentType } from "@drizzle/schema";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFetcher } from "@/lib/hooks/use-fetcher";
import { UpdateBlankSchema } from "@/lib/schemas/product-schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Blank = typeof blanks.$inferSelect;
type GarmentType = (typeof garmentType.enumValues)[number];

const GARMENT_TYPES: GarmentType[] = [
  "coat",
  "jacket",
  "hoodie",
  "crewneck",
  "longsleeve",
  "tee",
  "shorts",
  "sweatpants",
  "headwear",
  "accessory",
];

export function BlankInfoCard({ blank }: { blank: Blank }) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blank Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon icon="ph:buildings" className="text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">Company</div>
            <div className="font-medium capitalize">{blank.blankCompany}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="ph:t-shirt" className="text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">Garment Type</div>
            <div className="font-medium capitalize">{blank.garmentType}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Icon icon="ph:currency-dollar" className="text-muted-foreground" />
          <div>
            <div className="text-sm text-muted-foreground">Customs Price</div>
            <div className="font-medium">${blank.customsPrice.toFixed(2)}</div>
          </div>
        </div>
        {blank.hsCode && (
          <div className="flex items-center gap-2">
            <Icon icon="ph:barcode" className="text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">HS Code</div>
              <div className="font-medium">{blank.hsCode}</div>
            </div>
          </div>
        )}
        {blank.links && blank.links.length > 0 && (
          <div className="flex items-start gap-2">
            <Icon icon="ph:link" className="text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm text-muted-foreground">Links</div>
              <div className="flex flex-col gap-1">
                {blank.links.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate max-w-[200px]"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <EditBlankDialog blank={blank} onSuccess={() => router.refresh()} />
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// EditBlankDialog Component
// ============================================================================

function EditBlankDialog({ blank, onSuccess }: { blank: Blank; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [blankCompany, setBlankCompany] = useState(blank.blankCompany);
  const [blankName, setBlankName] = useState(blank.blankName);
  const [selectedGarmentType, setSelectedGarmentType] = useState<GarmentType>(blank.garmentType);
  const [customsPrice, setCustomsPrice] = useState(String(blank.customsPrice));
  const [hsCode, setHsCode] = useState(blank.hsCode || "");
  const [links, setLinks] = useState(blank.links.join("\n"));

  const { trigger, isLoading } = useFetcher<UpdateBlankSchema>({
    path: `/api/blanks/${blank.id}`,
    method: "PATCH",
    successMessage: "Blank updated",
    onSuccess: () => {
      setOpen(false);
      onSuccess();
    },
  });

  const resetForm = () => {
    setBlankCompany(blank.blankCompany);
    setBlankName(blank.blankName);
    setSelectedGarmentType(blank.garmentType);
    setCustomsPrice(String(blank.customsPrice));
    setHsCode(blank.hsCode || "");
    setLinks(blank.links.join("\n"));
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      resetForm();
    }
  };

  const handleSubmit = () => {
    const linksArray = links
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    trigger({
      blankCompany,
      blankName,
      garmentType: selectedGarmentType,
      customsPrice: parseFloat(customsPrice) || 0,
      hsCode: hsCode || null,
    });
  };

  const isValid = blankCompany.length > 0 && blankName.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Icon icon="ph:pencil" className="w-4 h-4" />
          Edit Blank
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Blank</DialogTitle>
          <DialogDescription>Update the information for this blank.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Company & Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="blankCompany">Company</Label>
              <Input
                id="blankCompany"
                placeholder="e.g. Gildan, Champion"
                value={blankCompany}
                onChange={(e) => setBlankCompany(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="blankName">Name</Label>
              <Input
                id="blankName"
                placeholder="e.g. Heavy Blend"
                value={blankName}
                onChange={(e) => setBlankName(e.target.value)}
              />
            </div>
          </div>

          {/* Garment Type */}
          <div className="grid gap-2">
            <Label htmlFor="garmentType">Garment Type</Label>
            <Select value={selectedGarmentType} onValueChange={(v) => setSelectedGarmentType(v as GarmentType)}>
              <SelectTrigger>
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

          {/* Customs Price & HS Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="customsPrice">Customs Price ($)</Label>
              <Input
                id="customsPrice"
                type="number"
                min="0"
                step="0.01"
                value={customsPrice}
                onChange={(e) => setCustomsPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hsCode">HS Code (optional)</Label>
              <Input
                id="hsCode"
                placeholder="e.g. 6110.20"
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid} loading={isLoading}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
