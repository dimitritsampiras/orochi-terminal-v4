import { OrderQuery } from "@/lib/types/admin.generated";
import { DataResponse } from "@/lib/types/misc";
import { shipments } from "@drizzle/schema";
import dayjs from "dayjs";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;
type Shipment = typeof shipments.$inferSelect;

type Options = {
  sessionId?: string;
  shippingLabelURL?: string;
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
  const fontSize = 12;

  // Letter size: 612 x 792 points
  const pageWidth = 612;
  const pageHeight = 792;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper to convert PDFKit Y (top-down) to pdf-lib Y (bottom-up)
  const toY = (pdfKitY: number) => pageHeight - pdfKitY;

  // Track current Y position (in PDFKit coordinates - top-down)
  let currentY = marginY;

  // Title
  page.drawText("PROJECT OROCHI", { x: marginX, y: toY(currentY + fontSize), size: fontSize, font });
  currentY += lineHeight;

  page.drawText(`Order number ${order.name}`, { x: marginX, y: toY(currentY + fontSize), size: fontSize, font });
  currentY += lineHeight * 2; // moveDown(2)

  const infoY = currentY;
  const contentY = infoY + lineHeight * titleSpacing;
  let multiplier = 1;

  if (!order.shippingAddress) {
    return { data: null, error: "Shipping address not found" };
  }

  const {
    shippingAddress: { address1, address2, city, provinceCode, zip, country },
  } = order;

  // SHIPPING INFO column
  page.drawText("SHIPPING INFO", { x: marginX, y: toY(infoY + fontSize), size: fontSize, font });
  page.drawText(normalizeText(address1 || ""), { x: marginX, y: toY(contentY + fontSize), size: fontSize, font });

  if (address2) {
    page.drawText(normalizeText(address2), {
      x: marginX,
      y: toY(contentY + lineHeight * multiplier + fontSize),
      size: fontSize,
      font,
    });
    multiplier++;
  }

  page.drawText(normalizeText(`${city || ""}, ${provinceCode || ""}, ${zip || ""}`), {
    x: marginX,
    y: toY(contentY + lineHeight * multiplier + fontSize),
    size: fontSize,
    font,
  });
  multiplier++;

  page.drawText(normalizeText(country || ""), {
    x: marginX,
    y: toY(contentY + lineHeight * multiplier + fontSize),
    size: fontSize,
    font,
  });

  // ORDER INFO column
  multiplier = 1;
  page.drawText("ORDER INFO", { x: marginX + infoColumnWidth, y: toY(infoY + fontSize), size: fontSize, font });
  page.drawText(`Order Placed: ${dayjs(order.createdAt).format("MMM DD, YYYY")}`, {
    x: marginX + infoColumnWidth,
    y: toY(contentY + fontSize),
    size: fontSize,
    font,
  });

  let orderInfoOffset = 1;

  if (sessionId) {
    page.drawText(`Batch: ${sessionId}`, {
      x: marginX + infoColumnWidth,
      y: toY(contentY + lineHeight * orderInfoOffset + fontSize),
      size: fontSize,
      font,
    });
    orderInfoOffset++;
  }

  if (shipment.chosenCarrierName) {
    page.drawText(`Shipping Provider: ${shipment.chosenCarrierName?.toUpperCase()}`, {
      x: marginX + infoColumnWidth,
      y: toY(contentY + lineHeight * orderInfoOffset + fontSize),
      size: fontSize,
      font,
    });
  }

  // Horizontal line
  multiplier = 4; // was multiplier += 3, starting from 1
  const lineY = toY(contentY + lineHeight * multiplier);
  page.drawLine({
    start: { x: marginX, y: lineY },
    end: { x: marginX + (pageWidth - marginX * 2), y: lineY },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  // ITEMS section
  multiplier += 2;
  let itemsY = contentY + lineHeight * multiplier;

  page.drawText("ITEMS", { x: marginX, y: toY(itemsY + fontSize), size: fontSize, font });
  itemsY += lineHeight;

  for (const item of lineItems) {
    const { name, quantity } = item;
    page.drawText(normalizeText(`${name} x${quantity}`), { x: marginX, y: toY(itemsY + fontSize), size: fontSize, font });
    itemsY += lineHeight * 1.5;
  }

  // Shipping label image (the critical part)
  if (shippingLabelURL) {
    const response = await fetch(shippingLabelURL);
    if (!response.ok) {
      return { data: null, error: "Failed to fetch shipping label" };
    }
    const arrayBuffer = await response.arrayBuffer();
    const imageBytes = new Uint8Array(arrayBuffer);

    // Determine image type and embed
    let image;
    try {
      image = await pdfDoc.embedPng(imageBytes);
    } catch {
      try {
        image = await pdfDoc.embedJpg(imageBytes);
      } catch {
        return { data: null, error: "Unsupported image format for shipping label" };
      }
    }

    // Original PDFKit positioning (matching exactly):
    // imageX = inchesToPoint(8.5 - 6 - 0.125) = inchesToPoint(2.375)
    // imageY = inchesToPoint(11 - 0.25 - 4) = inchesToPoint(6.75)
    // imageWidth = inchesToPoint(4)
    // imageHeight = inchesToPoint(6)
    // Then rotate 90° around (imageX, imageY) and draw at (imageX, inchesToPoint(0.725))

    const imageX = inchesToPoint(2.375); // 171pt
    const imageWidth = inchesToPoint(4); // 288pt - becomes vertical extent after rotation
    const imageHeight = inchesToPoint(6); // 432pt - becomes horizontal extent after rotation

    // After 90° rotation around origin point, the image placement changes
    // The original draws at Y = inchesToPoint(0.85 - 0.125) = inchesToPoint(0.725) ≈ 52.2pt from top
    // In pdf-lib coordinates (bottom-up), we need to calculate the final position

    // For the rotated label on integrated shipping paper:
    // The label needs to land in the bottom-right portion of the page
    // Original: rotated 90° CW, fitting in 4" wide x 6" tall area

    const labelX = pageWidth - inchesToPoint(0.125); // 594pt (right edge minus margin)
    const labelY = inchesToPoint(0.25); // 18pt (bottom margin)

    page.drawImage(image, {
      x: labelX,
      y: labelY,
      width: imageWidth,
      height: imageHeight,
      rotate: degrees(90),
    });
  }

  // Order number in big bold letters at bottom left, rotated 90 degrees
  const orderNumberFontSize = 50;
  const orderNumberX = inchesToPoint(1); // Left margin
  const orderNumberY = inchesToPoint(0.5); // Bottom margin (in pdf-lib coordinates, bottom-up)
  
  page.drawText(order.name, {
    x: orderNumberX,
    y: orderNumberY,
    size: orderNumberFontSize,
    font: boldFont,
    rotate: degrees(90),
  });

  const pdfBytes = await pdfDoc.save();
  return { data: Buffer.from(pdfBytes), error: null };
};

const inchesToPoint = (inches: number) => {
  return inches * 72;
};

// Normalize text to remove diacritical marks that WinAnsi encoding can't handle
const normalizeText = (text: string): string => {
  return text
    .normalize("NFD") // Decompose accented characters (e.g., "ň" → "n" + combining caron)
    .replace(/[\u0300-\u036f]/g, ""); // Remove combining diacritical marks
};
