import { type OrderQuery } from "@/lib/types/admin.generated";
import { shipments } from "@drizzle/schema";
import { type IAddressCreateParameters } from "@easypost/api";
import type { Address as ShippoAddress } from "shippo";

/**
 * Simple lookup map: shopify product type -> HS code
 * used as fallback
 * Usage: HS_CODE_LOOKUP["Apparel & Accessories"] returns "6200"
 */
export const HS_CODE_LOOKUP: Record<string, string> = {
  "Apparel & Accessories": "6200",
  Clothing: "6200",
  Activewear: "6211",
  "Bicycle Activewear": "6114.30",
  "Martial Arts Shorts": "6204.62",
  "Baby & Toddler Clothing": "6209",
  "Baby & Toddler Bottoms": "6209.20",
  "Baby & Toddler Diaper Covers": "9619.00",
  Dresses: "6204.42",
  Outerwear: "6201",
  "Coats & Jackets": "6201.93",
  Vests: "6211.33",
  Pants: "6203.42",
  "Shirts & Tops": "6205",
  "T-Shirts": "6109.10",
  Skirts: "6204.52",
  "Sleepwear & Loungewear": "6207",
  Suits: "6203.11",
  Swimwear: "6112.31",
  "Underwear & Socks": "6107",
  Bras: "6212.10",
  Socks: "6115.95",
  Belts: "4203.30",
  "Gloves & Mittens": "6116.92",
  Ties: "6215.10",
  Jewelry: "7113",
  Shoes: "6403",
  "Athletic Shoes": "6404.11",
  "Costumes & Accessories": "9505.90",
  "Handbags, Wallets & Cases": "4202",
};

export const EASYPOST_FROM_ADDRESS = {
  name: "DANIEL P.",
  company: "PRINT INC",
  street1: "2495 MAIN ST STE 302",
  street2: "",
  city: "BUFFALO",
  state: "NY",
  zip: "14214-2154",
  country: "US",
  phone: "15555555555",
  email: "PRINTPLUSFULFILLMENT@GMAIL.COM",
} satisfies IAddressCreateParameters;

export const SHIPPO_FROM_ADDRESS = {
  name: "DANIEL P.",
  company: "PRINT INC",
  street1: "2495 MAIN ST STE 302",
  street2: "",
  city: "BUFFALO",
  state: "NY",
  zip: "14214-2154",
  country: "US",
  phone: "15555555555",
  email: "PRINTPLUSFULFILLMENT@GMAIL.COM",
} satisfies ShippoAddress;

type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;

/**
 *
 * find out if the order requires a customs declaration
 */
export const requiresCustomsDeclaration = (order: Order): boolean => {
  const US_TERRITORIES = ["AMERICAN SAMOA", "GUAM", "NORTHERN MARIANA ISLANDS", "PUERTO RICO", "U.S. VIRGIN ISLANDS"];

  const MILITARY_CODES = ["AA", "AE", "AP", "APO", "FPO", "DPO"];

  if (!order.shippingAddress) {
    return false;
  }

  const { countryCodeV2, province, provinceCode } = order.shippingAddress;

  // Helper functions for specific checks
  const isInternationalShipment = countryCodeV2 !== "US";

  const isUSTerritory = !!province && US_TERRITORIES.includes(province.toUpperCase());

  const isMilitaryAddress =
    !!province &&
    (MILITARY_CODES.some((code) => province.toUpperCase().startsWith(code)) ||
      MILITARY_CODES.includes(provinceCode?.toUpperCase() || ""));

  // Perform checks
  return isInternationalShipment || isUSTerritory || isMilitaryAddress;
};

export type ShipmentIssueType = "none" | "unpurchased" | "refunded" | "missing_label";

export function getShipmentIssue(
  shipmentsList: (typeof shipments.$inferSelect)[]
): { type: ShipmentIssueType; label: string } | null {
  if (shipmentsList.length === 0) {
    return { type: "none", label: "No shipment" };
  }

  // Check if all shipments are refunded
  if (shipmentsList.every((s) => s.isRefunded)) {
    return { type: "refunded", label: "Refunded" };
  }

  // Check if any shipment is not purchased
  const hasUnpurchased = shipmentsList.some((s) => !s.isPurchased && !s.isRefunded);
  if (hasUnpurchased) {
    return { type: "unpurchased", label: "Unpurchased" };
  }

  // Check for missing label slips on purchased shipments
  const hasMissingLabel = shipmentsList.some((s) => s.isPurchased && !s.isRefunded && !s.labelSlipPath);
  if (hasMissingLabel) {
    return { type: "missing_label", label: "Missing label" };
  }

  // No issues - fully purchased with labels
  return null;
}
