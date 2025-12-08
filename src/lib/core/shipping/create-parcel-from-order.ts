import { db } from "@/lib/clients/db";
import { OrderQuery } from "@/lib/types/admin.generated";
import { blanks, blankVariants, lineItems, parcelTemplates, productVariants } from "@drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "../logger";
import { WeightUnit } from "@/lib/types/admin.types";
import { HS_CODE_LOOKUP } from "./shipping-utils";
import { DataResponse } from "@/lib/types/misc";

// TODO: figure out how to accomodate user selecting additional product to add to parcel

const PARCEL_WEIGHT_REDUCER = 0.8;
const ITEM_WEIGHT_FALLBACK = 16.0; // 16 ounces
const ITEM_VALUE_FALLBACK = 10.0; // 10 dollars
const ITEM_VOLUME_FALLBACK = 500; // max value to always overshoot parcel size
const PARCEL_TEMPLATE_FALLBACK = {
  name: "Large Parcel",
  widthCm: "48.00",
  lengthCm: "61.00",
  heightCm: "3.00",
  maxVolume: 3200,
};

type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;
type OrderLineItem = Order["lineItems"]["nodes"][number] & { orderId: string };

export interface GeneralParcel {
  totalWeight: number;
  totalValue: number;
  totalVolume: number;
  parcelTemplate: Omit<typeof parcelTemplates.$inferSelect, "id">;
  items: {
    weight: number;
    volume: number;
    value: number;
    quantity: number;
    customsDescription: string;
    hsCode: string;
    sku: string;
    lineItemId: string;
    itemName: string;
  }[];
}

export const createParcelFromOrder = async (order: Order): Promise<DataResponse<GeneralParcel>> => {
  // doing this so i can log item issues as part of the order later
  const orderLineItems = order.lineItems.nodes.map<OrderLineItem>((item) => ({ ...item, orderId: order.id }));

  if (orderLineItems.length === 0) {
    logger.error(`[create parcel] order ${order.name} has no line items`, {
      category: "SHIPPING",
      orderId: order.id,
    });
    return { error: `order ${order.name} has no line items`, data: null };
  }

  const databaseLineItemsAndBlankDataMap = await fetchLineItemBlankData(orderLineItems);
  const warehouseParcelTempaltes = await db.query.parcelTemplates.findMany();

  const parcelItems: GeneralParcel["items"] = [];
  for (const lineItem of orderLineItems) {
    const databaseLineItemAndBlankData = databaseLineItemsAndBlankDataMap.get(lineItem.id);
    const itemWeight = determineItemWeight(lineItem, databaseLineItemAndBlankData);
    const itemValue = determineItemValue(lineItem, databaseLineItemAndBlankData);
    const itemVolume = determineItemVolume(lineItem, databaseLineItemAndBlankData);
    const itemCustomsDescription = determineItemCustomsDescription(lineItem, databaseLineItemAndBlankData);
    const itemHsCode = determineHsCode(lineItem, databaseLineItemAndBlankData);

    parcelItems.push({
      sku: lineItem.id,
      weight: normalizeDecimal(itemWeight * PARCEL_WEIGHT_REDUCER), // ;)
      volume: normalizeDecimal(itemVolume),
      value: normalizeDecimal(itemValue),
      quantity: lineItem.quantity,
      customsDescription: itemCustomsDescription,
      hsCode: itemHsCode,
      lineItemId: lineItem.id,
      itemName: lineItem.name,
    });
  }

  const totalWeight = normalizeDecimal(parcelItems.reduce((acc, item) => acc + item.weight, 0));
  const totalVolume = normalizeDecimal(parcelItems.reduce((acc, item) => acc + item.volume, 0));
  const totalValue = normalizeDecimal(parcelItems.reduce((acc, item) => acc + item.value, 0));

  const parcelTemplate = determineParcelTemplate(warehouseParcelTempaltes, totalWeight, totalVolume);

  const parcel: GeneralParcel = {
    totalWeight,
    totalVolume,
    totalValue,
    parcelTemplate,
    items: parcelItems,
  };

  return {
    data: parcel,
    error: null,
  };
};

const determineItemWeight = (
  orderLineItem: OrderLineItem,
  blankData?: { blankVariant: typeof blankVariants.$inferSelect | null; blank: typeof blanks.$inferSelect | null }
) => {
  const blankWeight = blankData?.blankVariant?.weight;
  const orderLineItemWeight = orderLineItem.variant?.inventoryItem.measurement.weight;

  if (blankWeight) {
    return blankWeight;
  }

  if (orderLineItemWeight) {
    return convertToOunces(orderLineItemWeight.unit, orderLineItemWeight.value);
  }

  logger.warn(`[create parcel] Cannot deterine ${orderLineItem.name} weight. Defaulting to 16 ounces.`, {
    orderId: orderLineItem.orderId,
    category: "SHIPPING",
  });

  return ITEM_WEIGHT_FALLBACK; // fallback weight
};

const determineItemValue = (
  orderLineItem: OrderLineItem,
  blankData?: { blankVariant: typeof blankVariants.$inferSelect | null; blank: typeof blanks.$inferSelect | null }
) => {
  const blankValue = blankData?.blank?.customsPrice;
  const orderLineItemValue = orderLineItem.originalTotalSet.shopMoney.amount;

  if (blankValue) {
    return blankValue;
  }

  return orderLineItemValue * 0.15 || ITEM_VALUE_FALLBACK;
};

const determineItemVolume = (
  orderLineItem: OrderLineItem,
  blankData?: { blankVariant: typeof blankVariants.$inferSelect | null; blank: typeof blanks.$inferSelect | null }
) => {
  const blankVolume = blankData?.blankVariant?.volume;

  if (blankVolume) {
    return blankVolume;
  }

  logger.warn(`[create parcel] Cannot deterine ${orderLineItem.name} volume. Defaulting to 500.`, {
    orderId: orderLineItem.orderId,
    category: "SHIPPING",
  });

  // TODO: be able to set volume at product level, on shopify or database
  return ITEM_VOLUME_FALLBACK;
};

const determineItemCustomsDescription = (
  orderLineItem: OrderLineItem,
  blankData?: { blankVariant: typeof blankVariants.$inferSelect | null; blank: typeof blanks.$inferSelect | null }
) => {
  const blankGarmentType = blankData?.blank?.garmentType;
  const blankColor = blankData?.blankVariant?.color;

  if (blankColor && blankGarmentType) {
    return `Wholsale ${blankColor} ${blankGarmentType}`;
  }

  if (!blankColor && blankGarmentType) {
    return `Wholsale ${blankGarmentType}`;
  }

  const productType = orderLineItem.product?.productType;

  if (productType) {
    return `Wholesale ${productType}`;
  }

  logger.warn(
    `[create parcel] Cannot deterine ${orderLineItem.name} customs description. Defaulting to "Wholesale sweater".`,
    {
      orderId: orderLineItem.orderId,
      category: "SHIPPING",
    }
  );

  // no blank
  return `Wholesale sweater`;
};

const determineHsCode = (
  orderLineItem: OrderLineItem,
  blankData?: { blankVariant: typeof blankVariants.$inferSelect | null; blank: typeof blanks.$inferSelect | null }
) => {
  const blankHsCode = blankData?.blank?.hsCode;
  const productType = orderLineItem.product?.productType;

  if (blankHsCode) {
    return blankHsCode;
  }

  if (productType) {
    const hsCode = HS_CODE_LOOKUP[productType];
    if (hsCode) {
      return hsCode;
    }
  }
  logger.warn(`[create parcel] Cannot deterine ${orderLineItem.name} hs code. Defaulting to "6117.80".`, {
    orderId: orderLineItem.orderId,
    category: "SHIPPING",
  });

  return "6117.80";
};

const determineParcelTemplate = (
  warehouseParcelTempaltes: (typeof parcelTemplates.$inferSelect)[],
  totalWeight: number,
  totalVolume: number
) => {
  const parcelTemplate = warehouseParcelTempaltes.find((template) => template.maxVolume >= totalVolume);
  if (parcelTemplate) {
    return parcelTemplate;
  }
  logger.warn(`[create parcel] No parcel template found for order. Defaulting to "X-Large Parcel".`, {
    category: "SHIPPING",
  });
  return PARCEL_TEMPLATE_FALLBACK; // fallback;
};

const convertToOunces = (fromUnit: WeightUnit, value: number): number => {
  const conversionFactors: Record<WeightUnit, number> = {
    GRAMS: 0.035274,
    KILOGRAMS: 35.274,
    OUNCES: 1,
    POUNDS: 16,
  };
  return normalizeDecimal(value * (conversionFactors[fromUnit] || 1));
};

const fetchLineItemBlankData = async (orderLineItems: OrderLineItem[]) => {
  const databaseLineItemsAndBlankData = await db
    .select({
      blankVariant: blankVariants,
      blank: blanks,
      lineItemId: lineItems.id,
    })
    .from(lineItems)
    .leftJoin(productVariants, eq(lineItems.variantId, productVariants.id))
    .leftJoin(blankVariants, eq(productVariants.blankVariantId, blankVariants.id))
    .leftJoin(blanks, eq(blankVariants.blankId, blanks.id))
    .where(
      inArray(
        lineItems.id,
        orderLineItems.map((item) => item.id)
      )
    );

  const databaseLineItemsAndBlankDataMap = new Map<
    string,
    { blankVariant: typeof blankVariants.$inferSelect | null; blank: typeof blanks.$inferSelect | null }
  >(
    databaseLineItemsAndBlankData.map((item) => [
      item.lineItemId,
      { blankVariant: item.blankVariant, blank: item.blank },
    ])
  );

  return databaseLineItemsAndBlankDataMap;
};

const normalizeDecimal = (value: number): number => {
  return Number(value.toFixed(2));
};
