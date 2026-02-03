import {
  blankVariants,
  garmentSize,
  lineItemCompletionStatus,
  lineItems,
  printLocation,
  prints,
  products,
  productVariants,
} from "@drizzle/schema";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  toZonedTime,
  fromZonedTime,
  format as formatTz
} from 'date-fns-tz';
import {
  startOfDay as startOfDayFns,
  endOfDay as endOfDayFns,
  startOfWeek as startOfWeekFns,
  endOfWeek as endOfWeekFns,
  startOfMonth as startOfMonthFns,
  endOfMonth as endOfMonthFns,
} from 'date-fns';

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

export const normalizeSizeName = (size: (typeof garmentSize.enumValues)[number]) => {
  switch (size) {
    case "xs":
      return "xsmall";
    case "sm":
      return "small";
    case "md":
      return "medium";
    case "lg":
      return "large";
  }
  return size.toLowerCase().replace(/ /g, "_");
};

/**
 * Timezone utilities for consistent EST/EDT handling across the application
 *
 * All analytics should use these functions to ensure dates are calculated
 * in Eastern Time (America/New_York), which automatically handles DST transitions.
 */

/**
 * Eastern Time Zone identifier
 * Automatically handles EST (UTC-5) and EDT (UTC-4) based on DST rules
 */
export const EASTERN_TIMEZONE = 'America/New_York';

/**
 * Get current date/time in Eastern Time
 */
export function nowInEastern(): Date {
  return toZonedTime(new Date(), EASTERN_TIMEZONE);
}

/**
 * Convert a Date to Eastern Time
 */
export function toEastern(date: Date): Date {
  return toZonedTime(date, EASTERN_TIMEZONE);
}

/**
 * Convert an Eastern Time date back to UTC/system time
 */
export function fromEastern(date: Date): Date {
  return fromZonedTime(date, EASTERN_TIMEZONE);
}

/**
 * Get start of day in Eastern Time
 */
export function startOfDayEastern(date: Date): Date {
  const easternDate = toEastern(date);
  const startOfDayET = startOfDayFns(easternDate);
  return fromEastern(startOfDayET);
}

/**
 * Get end of day in Eastern Time
 */
export function endOfDayEastern(date: Date): Date {
  const easternDate = toEastern(date);
  const endOfDayET = endOfDayFns(easternDate);
  return fromEastern(endOfDayET);
}

/**
 * Get start of week (Monday) in Eastern Time
 */
export function startOfWeekEastern(date: Date): Date {
  const easternDate = toEastern(date);
  const startOfWeekET = startOfWeekFns(easternDate, { weekStartsOn: 1 }); // Monday
  return fromEastern(startOfWeekET);
}

/**
 * Get end of week (Sunday) in Eastern Time
 */
export function endOfWeekEastern(date: Date): Date {
  const easternDate = toEastern(date);
  const endOfWeekET = endOfWeekFns(easternDate, { weekStartsOn: 1 }); // Monday-Sunday
  return fromEastern(endOfWeekET);
}

/**
 * Get start of month in Eastern Time
 */
export function startOfMonthEastern(date: Date): Date {
  const easternDate = toEastern(date);
  const startOfMonthET = startOfMonthFns(easternDate);
  return fromEastern(startOfMonthET);
}

/**
 * Get end of month in Eastern Time
 */
export function endOfMonthEastern(date: Date): Date {
  const easternDate = toEastern(date);
  const endOfMonthET = endOfMonthFns(easternDate);
  return fromEastern(endOfMonthET);
}

/**
 * Get current week (Monday-Sunday) in Eastern Time
 */
export function getCurrentWeekEastern(): { start: Date; end: Date } {
  const now = nowInEastern();

  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Calculate Monday at midnight Eastern
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  // Calculate Sunday at 23:59:59.999 Eastern
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Convert to UTC for storage/API
  return {
    start: fromEastern(monday),
    end: fromEastern(sunday)
  };
}

/**
 * Format a date in Eastern Time
 * @param date - Date to format
 * @param formatString - Format string (date-fns format)
 */
export function formatInEastern(date: Date, formatString: string): string {
  return formatTz(date, formatString, { timeZone: EASTERN_TIMEZONE });
}

/**
 * Get date range for analytics queries in Eastern Time
 * Ensures consistent boundaries for all analytics calculations
 */
export function getAnalyticsDateRange(start: Date, end: Date): { start: Date; end: Date } {
  return {
    start: startOfDayEastern(start),
    end: endOfDayEastern(end)
  };
}
