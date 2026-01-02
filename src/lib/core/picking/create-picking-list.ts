import { AssemblyLineItem } from "@/lib/core/session/create-assembly-line";
import { garmentSize, garmentType } from "@drizzle/schema";

type GarmentSize = (typeof garmentSize.enumValues)[number];
type GarmentType = (typeof garmentType.enumValues)[number];

export interface PickingItem {
  color: string;
  garmentType: GarmentType;
  size: GarmentSize;
  blankName: string;
  quantity: number;
}

export interface PickingListResult {
  sortedPickingList: PickingItem[];
  unaccountedLineItems: AssemblyLineItem[];
}

export const createPickingList = (lineItems: AssemblyLineItem[]): PickingListResult => {
  const pickingList: PickingItem[] = [];
  const unaccountedLineItems: AssemblyLineItem[] = [];

  const filteredLineItems = lineItems.filter((item) => item.requiresShipping);
  for (const item of filteredLineItems) {
    const blank = item.blank;
    const blankVariant = item.blankVariant;

    if (blank && blankVariant) {
      const pickingItem: PickingItem = {
        blankName: `${abbreviateBlankName(blank.blankCompany)} ${blank.blankName}`,
        color: blankVariant.color,
        garmentType: blank.garmentType,
        size: blankVariant.size,
        quantity: item.quantity,
      };

      const existingItemIndex = pickingList.findIndex(
        (pi) =>
          pi.color === pickingItem.color &&
          pi.garmentType === pickingItem.garmentType &&
          pi.size === pickingItem.size &&
          pi.blankName === pickingItem.blankName
      );

      if (existingItemIndex !== -1) {
        pickingList[existingItemIndex].quantity += pickingItem.quantity;
      } else {
        pickingList.push(pickingItem);
      }
    } else {
      unaccountedLineItems.push(item);
    }
  }

  const sortedPickingList = pickingList.sort((a, b) => {
    const colorComparison = compareColor(a.color, b.color);
    if (colorComparison !== 0) return colorComparison;

    const garmentComparison = compareGarment(a.garmentType, b.garmentType);
    if (garmentComparison !== 0) return garmentComparison;

    return compareSize(a.size, b.size);
  });

  return { sortedPickingList, unaccountedLineItems };
};

const compareColor = (a?: string, b?: string): number => {
  const colorOrder = ["black", "white"];
  const aIndex = a ? colorOrder.indexOf(a.toLowerCase()) : -1;
  const bIndex = b ? colorOrder.indexOf(b.toLowerCase()) : -1;

  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;

  return (a || "").localeCompare(b || "");
};

const compareGarment = (a?: GarmentType, b?: GarmentType): number => {
  const garmentOrder: GarmentType[] = ["hoodie", "crewneck", "longsleeve", "tee"];
  const aIdx = a ? garmentOrder.indexOf(a) : -1;
  const bIdx = b ? garmentOrder.indexOf(b) : -1;
  return (aIdx === -1 ? garmentOrder.length : aIdx) - (bIdx === -1 ? garmentOrder.length : bIdx);
};

const compareSize = (a?: GarmentSize, b?: GarmentSize): number => {
  const sizeOrder: GarmentSize[] = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "os"];
  const aIdx = a ? sizeOrder.indexOf(a) : -1;
  const bIdx = b ? sizeOrder.indexOf(b) : -1;
  return (aIdx === -1 ? sizeOrder.length : aIdx) - (bIdx === -1 ? sizeOrder.length : bIdx);
};

const abbreviateBlankName = (name: string) => {
  if (name === "independant") return "ind";
  return name;
};

