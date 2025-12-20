import shopify from "@/lib/clients/shopify";
import { orderQuery } from "@/lib/graphql/order.graphql";
import { DataResponse } from "@/lib/types/misc";
import { shipments } from "@drizzle/schema";
import { generatePackingSlip } from "../pdf/generate-packing-slip";
import { admin } from "@/lib/clients/supabase-admin";
import { logger } from "../logger";
import { db } from "@/lib/clients/db";
import { eq } from "drizzle-orm";

type Shipment = typeof shipments.$inferSelect;

export const createAndStoreShippingDocs = async (
  shipment: Shipment,
  orderId: string,
  shippingLabelURL: string
): Promise<DataResponse<"success">> => {
  const { data: orderData, errors: orderErrors } = await shopify.request(orderQuery, {
    variables: { id: orderId },
  });

  if (!orderData?.node || orderData.node.__typename !== "Order") {
    return { data: null, error: orderErrors?.message || "An error occuered" };
  }
  const order = orderData.node;

  const fileName = `packing-slip-${order.name.replace("#", "")}-${shipment.id}.pdf`;
  const labelPath = `integrated-slips/${fileName}`;
  const plainPath = `plain-slips/${fileName}`;

  const [{ data: labelSlipBuffer, error: labelSlipError }, { data: packingSlipBuffer, error: packingSlipError }] =
    await Promise.all([
      generatePackingSlip(order, shipment, {
        lineItemIds: shipment.lineItemIds || undefined,
        shippingLabelURL,
      }),
      generatePackingSlip(order, shipment, {
        lineItemIds: shipment.lineItemIds || undefined,
      }),
    ]);

  if (!labelSlipBuffer) {
    logger.error(`[create and store shipping docs] Failed to generate label slip: ${labelSlipError}`, {
      category: "SHIPPING",
      orderId,
    });
  } else {
    await admin.storage.from("packing-slips").upload(labelPath, labelSlipBuffer, {
      contentType: "application/pdf",
    });
    await db
      .update(shipments)
      .set({
        labelSlipPath: labelPath,
      })
      .where(eq(shipments.id, shipment.id));
  }

  if (!packingSlipBuffer) {
    logger.error(`[create and store shipping docs] Failed to generate packing slip: ${packingSlipError}`, {
      category: "SHIPPING",
      orderId,
    });
  } else {
    await admin.storage.from("packing-slips").upload(plainPath, packingSlipBuffer, {
      contentType: "application/pdf",
    });
    await db
      .update(shipments)
      .set({
        plainSlipPath: plainPath,
      })
      .where(eq(shipments.id, shipment.id));
  }

  return { data: "success", error: null };
};
