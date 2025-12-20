import { OrderQuery } from "@/lib/types/admin.generated";
import { DataResponse } from "@/lib/types/misc";
import { shipments } from "@drizzle/schema";
import dayjs from "dayjs";
import PDFDocument from "pdfkit";

type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;
type Shipment = typeof shipments.$inferSelect;

type Options = {
  sessionId?: string;
  shippingLabelURL?: string;
  // only include these line items on the packing slip
  lineItemIds?: string[];
};

export const generatePackingSlip = async (
  order: Order,
  shipment: Shipment,
  { sessionId, shippingLabelURL, lineItemIds }: Options = {}
): Promise<DataResponse<Buffer>> => {
  const lineItems = order.lineItems.nodes
    .filter((item) => item.requiresShipping)
    .filter((item) => !lineItemIds || lineItemIds.includes(item.id))
    .map((item) => ({ name: item.name, quantity: item.quantity }));

  const marginX = 50;
  const marginY = 50;
  const titleSpacing = 1.5;
  const lineHeight = 15;
  const infoColumnWidth = 215;

  // Create a PDF document

  const doc = new PDFDocument({
    margins: {
      top: marginY,
      bottom: marginY,
      left: marginX,
      right: marginX,
    },
  });

  doc.text(`PROJECT OROCHI`);
  doc.text(`Order number ${order.name}`);
  doc.moveDown(2);

  const infoY = doc.y;

  const contentY = infoY + lineHeight * titleSpacing;
  let multiplier = 1;

  if (!order.shippingAddress) {
    return { data: null, error: "Shipping address not found" };
  }

  const {
    shippingAddress: { address1, address2, city, provinceCode, zip, country },
  } = order;

  doc.text("SHIPPING INFO", marginX, infoY);
  doc.text(address1 || "", marginX, contentY);

  address2 && doc.text(address2, marginX, contentY + lineHeight * multiplier++);

  doc.text(`${city || ""}, ${provinceCode || ""}, ${zip || ""}`, marginX, contentY + lineHeight * multiplier++);

  doc.text(country || "", marginX, contentY + lineHeight * multiplier++);

  multiplier = 1;
  doc.text("ORDER INFO", marginX + infoColumnWidth, infoY);
  doc.text(`Order Placed: ${dayjs(order.createdAt).format("MMM DD, YYYY")}`, marginX + infoColumnWidth, contentY);
  if (sessionId) {
    doc.text(`Batch: ${sessionId}`, marginX + infoColumnWidth, contentY + lineHeight);
  }

  // render carrier
  if (shipment.chosenCarrierName) {
    doc.text(
      `Shipping Provider: ${shipment.chosenCarrierName?.toUpperCase()}`,
      marginX + infoColumnWidth,
      contentY + lineHeight * 2
    );
  }

  // Add more content as needed based on the shipment data

  // line
  doc
    .moveTo(marginX, contentY + lineHeight * (multiplier += 3))
    .lineTo(marginX + (doc.page.width - marginX * 2), contentY + lineHeight * multiplier)
    .stroke();

  // reset y and x
  doc.y = contentY + lineHeight * (multiplier += 2);
  doc.x = marginX;

  doc.text("ITEMS");
  doc.y += lineHeight;
  for (const item of lineItems) {
    const { name, quantity } = item;
    doc.text(`${name} x${quantity}`);
    doc.y += lineHeight * 0.5;
  }

  if (shippingLabelURL) {
    const response = await fetch(shippingLabelURL);
    if (!response.ok) {
      return { data: null, error: "Failed to fetch shipping label" };
    }
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const imageX = inchesToPoint(8.5 - 6 - 0.125);
    const imageY = inchesToPoint(11 - 0.25 - 4);
    const imageWidth = inchesToPoint(4);
    const imageHeight = inchesToPoint(6);

    doc.rotate(90, { origin: [imageX, imageY] });

    doc.image(imageBuffer, imageX, inchesToPoint(0.85 - 0.125), {
      fit: [imageWidth, imageHeight],
    });
  }

  // Convert the PDF to a buffer
  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });

  return { data: pdfBuffer, error: null };
};

const inchesToPoint = (inches: number) => {
  return inches * (792.0 / 11);
};
