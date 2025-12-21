import {
  blankVariants,
  lineItemCompletionStatus,
  lineItems,
  printLocation,
  prints,
  products,
  productVariants,
} from "@drizzle/schema";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

export function debounce<T extends (...args: unknown[]) => unknown>(callback: T, ms = 300) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), ms);
  };
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseGid(gid: string) {
  return gid.split("/").pop();
}

export function buildResourceGid(resource: "Order" | "Product" | "LineItem" | "ProductVariant", id: string) {
  return `gid://shopify/${resource}/${id}`;
}

export const isOrderComplete = (items: (typeof lineItems.$inferSelect)[]) => {
  return items.every((item) =>
    (["printed", "ignore", "in_stock"] as (typeof lineItemCompletionStatus.enumValues)[number][]).includes(
      item.completionStatus
    )
  );
};

export const standardizePrintOrder = (printList: (typeof prints.$inferSelect)[]) => {
  const printLocationOrder: Record<(typeof printLocation.enumValues)[number], number> = {
    back: 0,
    front: 1,
    left_sleeve: 2,
    right_sleeve: 3,
    other: 4,
  };

  return printList.sort((a, b) => {
    return printLocationOrder[a.location] - printLocationOrder[b.location];
  });
};

export const getProductDetailsForARXP = (
  product: Pick<typeof products.$inferSelect, "title">,
  productVariant: Pick<typeof productVariants.$inferSelect, "title">,
  printIndex: number
) => {
  const productGarmentTypeNames = [
    "box hoodie",
    "box tee",
    "box longsleeve",
    "longsleeve",
    "box crewneck",
    "crewneck",
    "hoodie",
    "tee",
    "sweatpants",
    "shorts",
    "pants",
    "jackets",
  ];

  // Split by " - " to separate color from the rest
  const titleParts = product.title.split(" - ");
  const titleWithoutColor = titleParts[0].trim();
  const color = titleParts[1]?.trim()?.toLowerCase() || "";

  // Find and remove the garment type from the end
  const titleLower = titleWithoutColor.toLowerCase();
  let baseName = titleWithoutColor.toLowerCase();

  for (const garmentType of productGarmentTypeNames) {
    if (titleLower.endsWith(` ${garmentType}`) || titleLower === garmentType) {
      // Remove the garment type from the end (case-sensitive match)
      const garmentTypeIndex = baseName.toLowerCase().lastIndexOf(` ${garmentType}`);
      if (garmentTypeIndex !== -1) {
        baseName = baseName.substring(0, garmentTypeIndex).trim();
      } else if (baseName.toLowerCase() === garmentType) {
        baseName = "";
      }
      break; // Found and removed, no need to check others
    }
  }

  const size = productVariant.title.toLowerCase().trim();

  const baseNameForPath = baseName.replace(/ /g, "_");
  const colorForPath = color.replace(/ /g, "_");
  const fileName = `${baseNameForPath}_${colorForPath}_${size}_${printIndex}.arxp`;

  const path = `${baseName.replace(/ /g, "_")}/${color.replace(/ /g, "_")}/${fileName}`;

  return { baseName, color, size, path };
};

export const getCarrierImage = (carrierName: string) => {
  const baseUrl = "https://assets.easyship.com/app/courier-logos/";

  const carriers: { [key: string]: string } = {
    asendia: "asendia-mini.svg",
    globalpost: "globalpost-mini.svg",
    aramex: "aramex-mini.svg",
    orangeds: "orangeds-mini.svg",
    usps: "usps-mini.svg",
    ups: "ups-mini.svg",
    upsdap: "ups-mini.svg",
    dhl: "dhl-mini.svg",
    shypmax: "shypmax-mini.svg",
    skypostal: "skypostal-mini.svg",
    sfexpress: "sfexpress-mini.svg",
    sendle: "sendle-mini.svg",
    bringer: "bringer-mini.svg",
    apc: "apc-mini.svg",
    apg: "apg-mini.svg",
    fedex: "fedex-mini.svg",
    fedexdefault: "fedex-mini.svg",
  };

  for (const carrier in carriers) {
    if (carrierName.toLowerCase().includes(carrier)) {
      return `${baseUrl}${carriers[carrier]}`;
    }
  }
};
