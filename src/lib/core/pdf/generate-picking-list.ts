import { AssemblyLineItem } from "@/lib/core/session/create-assembly-line";
import { createPickingList } from "@/lib/core/picking/create-picking-list";
import { DataResponse } from "@/lib/types/misc";
import { batches, garmentSize } from "@drizzle/schema";
import dayjs from "dayjs";
import { PDFDocument, StandardFonts } from "pdf-lib";

type Batch = typeof batches.$inferSelect;
type GarmentSize = (typeof garmentSize.enumValues)[number];

export const generatePickingList = async (
  assemblyLine: AssemblyLineItem[],
  batch: Pick<Batch, "id" | "createdAt" | "active">
): Promise<DataResponse<Buffer>> => {
  const { sortedPickingList: pickingList, unaccountedLineItems } = createPickingList(assemblyLine);

  const marginX = 50;
  const marginY = 50;

  // A4 size: 595 x 842 points
  const pageWidth = 595;
  const pageHeight = 842;

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper to convert top-down Y to pdf-lib bottom-up Y
  const toY = (topDownY: number) => pageHeight - topDownY;

  // Table headers and column widths
  const headers = ["Blank", "Color", "Size", "Type", "Qty", "Check"];
  const colWidths = [130, 100, 70, 110, 50, 50];

  // Font sizes
  const titleFontSize = 12;
  const headerFontSize = 10;
  const bodyFontSize = 10;
  const lineHeight = 15;

  let pageNumber = 1;
  let currentY = marginY;

  // Helper to draw a row
  const drawRow = (items: string[], isBold: boolean = false) => {
    const currentFont = isBold ? fontBold : font;
    let xOffset = marginX;

    items.forEach((item, i) => {
      // Truncate text if it's too wide for the column
      let displayText = item;
      const maxWidth = colWidths[i] - 4;
      let textWidth = currentFont.widthOfTextAtSize(displayText, bodyFontSize);

      while (textWidth > maxWidth && displayText.length > 0) {
        displayText = displayText.slice(0, -1);
        textWidth = currentFont.widthOfTextAtSize(displayText + "…", bodyFontSize);
      }
      if (displayText !== item && displayText.length > 0) {
        displayText += "…";
      }

      page.drawText(displayText, {
        x: xOffset,
        y: toY(currentY + bodyFontSize),
        size: bodyFontSize,
        font: currentFont,
      });
      xOffset += colWidths[i];
    });

    currentY += lineHeight * 0.8;
  };

  // Helper to draw headers on new page
  const drawHeaders = () => {
    drawRow(headers, true);
  };

  // Helper to add a new page
  const addNewPage = () => {
    // Add page number at bottom of current page
    page.drawText(`${pageNumber}`, {
      x: pageWidth - 60,
      y: marginY,
      size: 8,
      font,
    });

    page = pdfDoc.addPage([pageWidth, pageHeight]);
    pageNumber++;
    currentY = marginY;

    // Draw page number indicator at top-right
    page.drawText(`Page ${pageNumber}`, {
      x: pageWidth - marginX - 40,
      y: toY(marginY - 5),
      size: 8,
      font,
    });

    drawHeaders();
  };

  // Title: "Picking List"
  page.drawText("Picking List", {
    x: marginX,
    y: toY(currentY + titleFontSize),
    size: titleFontSize,
    font: fontBold,
  });
  currentY += lineHeight;

  // Session info
  page.drawText(`Session number: ${batch.id}`, {
    x: marginX,
    y: toY(currentY + headerFontSize),
    size: headerFontSize,
    font,
  });
  currentY += lineHeight;

  page.drawText(`Created At: ${dayjs(batch.createdAt).format("MMMM D, YYYY")}`, {
    x: marginX,
    y: toY(currentY + headerFontSize),
    size: headerFontSize,
    font,
  });
  currentY += lineHeight * 2; // moveDown equivalent

  // Draw headers
  drawHeaders();

  // Draw table rows
  for (const pickingItem of pickingList) {
    // Check if we need a new page (30 points buffer for bottom margin)
    if (currentY > pageHeight - marginY - 30) {
      addNewPage();
    }

    const rowData = [
      pickingItem.blankName,
      pickingItem.color,
      dbSizeToDisplaySize(pickingItem.size),
      pickingItem.garmentType,
      pickingItem.quantity.toString(),
      "____",
    ];

    drawRow(rowData, false);
  }

  // Add unaccounted items section if any
  if (unaccountedLineItems.length > 0) {
    currentY += lineHeight * 3;

    // Check if we need a new page for unaccounted section
    if (currentY > pageHeight - marginY - 100) {
      addNewPage();
    }

    page.drawText("Unaccounted Items", {
      x: marginX,
      y: toY(currentY + titleFontSize),
      size: titleFontSize,
      font: fontBold,
    });
    currentY += lineHeight * 1.5;

    for (const item of unaccountedLineItems) {
      if (currentY > pageHeight - marginY - 30) {
        addNewPage();
      }

      page.drawText(item.name, {
        x: marginX,
        y: toY(currentY + bodyFontSize),
        size: bodyFontSize,
        font,
      });
      currentY += lineHeight;
    }
  }

  // Add final page number
  page.drawText(`${pageNumber}`, {
    x: pageWidth - 60,
    y: marginY,
    size: 8,
    font,
  });

  const pdfBytes = await pdfDoc.save();
  return { data: Buffer.from(pdfBytes), error: null };
};

const dbSizeToDisplaySize = (size?: GarmentSize): string => {
  if (!size) return "--";
  const map: Record<GarmentSize, string> = {
    xs: "xsmall",
    sm: "small",
    md: "medium",
    lg: "large",
    xl: "xlarge",
    "2xl": "2XL",
    "3xl": "3XL",
    "4xl": "4XL",
    "5xl": "5XL",
    os: "one-size",
  };
  return map[size];
};
