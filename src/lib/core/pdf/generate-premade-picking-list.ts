import type { DataResponse } from "@/lib/types/misc";
import type { batches } from "@drizzle/schema";
import dayjs from "dayjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SessionLineItem } from "../session/get-session-line-items";
import { getPremadeStockRequirements } from "../session/get-premade-stock-requirements";

type Batch = typeof batches.$inferSelect;

export const generatePremadePickingList = async (
	sessionLineItems: SessionLineItem[],
	batch: Pick<Batch, "id" | "createdAt" | "active">,
): Promise<DataResponse<Buffer>> => {
	const { items } = getPremadeStockRequirements(sessionLineItems);

	// Convert stockMap to array and sort: overstock first, then black label, then alphabetically
	const stockItems = items.sort((a, b) => {
		if (a.isBlackLabel !== b.isBlackLabel) {
			return a.isBlackLabel ? 1 : -1;
		}
		return a.productName.localeCompare(b.productName);
	});

	const marginX = 50;
	const marginY = 50;

	// A4 size: 595 x 842 points
	const pageWidth = 595;
	const pageHeight = 842;

	const pdfDoc = await PDFDocument.create();
	let page = pdfDoc.addPage([pageWidth, pageHeight]);
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

	// Helper to convert top-down Y to pdf-lib bottom-up Y
	const toY = (topDownY: number) => pageHeight - topDownY;

	// Font sizes
	const titleFontSize = 14;
	const sectionFontSize = 12;
	const headerFontSize = 10;
	const bodyFontSize = 10;
	const smallFontSize = 8;
	const lineHeight = 15;

	let pageNumber = 1;
	let currentY = marginY;

	// Stock table headers and column widths
	const stockHeaders = [
		"Product",
		"Type",
		"On Hand",
		"Req.",
		"To Pick",
		"Check",
	];
	const stockColWidths = [230, 70, 55, 50, 45, 35];
	const fadedColumns = [2, 3]; // On Hand and Required are faded

	// Helper to draw a stock row
	const drawStockRow = (rowItems: string[], isBold: boolean = false) => {
		const currentFont = isBold ? fontBold : font;
		let xOffset = marginX;

		rowItems.forEach((item, i) => {
			let displayText = item;
			const maxWidth = stockColWidths[i] - 4;
			let textWidth = currentFont.widthOfTextAtSize(displayText, bodyFontSize);

			while (textWidth > maxWidth && displayText.length > 0) {
				displayText = displayText.slice(0, -1);
				textWidth = currentFont.widthOfTextAtSize(
					displayText + "…",
					bodyFontSize,
				);
			}
			if (displayText !== item && displayText.length > 0) {
				displayText += "…";
			}

			// Fade On Hand and Required columns (not headers)
			const isFaded = !isBold && fadedColumns.includes(i);

			page.drawText(displayText, {
				x: xOffset,
				y: toY(currentY + bodyFontSize),
				size: bodyFontSize,
				font: currentFont,
				color: isFaded ? rgb(0.5, 0.5, 0.5) : rgb(0, 0, 0),
			});
			xOffset += stockColWidths[i];
		});

		currentY += lineHeight * 0.8;
	};

	// Helper to add a new page
	const addNewPage = () => {
		// Add page number at bottom of current page
		page.drawText(`${pageNumber}`, {
			x: pageWidth - 60,
			y: marginY,
			size: smallFontSize,
			font,
		});

		page = pdfDoc.addPage([pageWidth, pageHeight]);
		pageNumber++;
		currentY = marginY;

		// Draw page number indicator at top-right
		page.drawText(`Page ${pageNumber}`, {
			x: pageWidth - marginX - 40,
			y: toY(marginY - 5),
			size: smallFontSize,
			font,
		});
	};

	// ========== TITLE ==========
	page.drawText("Premade Stock Picking List", {
		x: marginX,
		y: toY(currentY + titleFontSize),
		size: titleFontSize,
		font: fontBold,
	});
	currentY += lineHeight * 1.5;

	// Session info
	page.drawText(`Session: ${batch.id}`, {
		x: marginX,
		y: toY(currentY + headerFontSize),
		size: headerFontSize,
		font,
	});
	currentY += lineHeight;

	page.drawText(`Created: ${dayjs(batch.createdAt).format("MMMM D, YYYY")}`, {
		x: marginX,
		y: toY(currentY + headerFontSize),
		size: headerFontSize,
		font,
	});
	currentY += lineHeight * 2;

	// ========== MAIN SECTION: Premade Stock Items ==========
	if (stockItems.length > 0) {
		page.drawText("Items to Pick", {
			x: marginX,
			y: toY(currentY + sectionFontSize),
			size: sectionFontSize,
			font: fontBold,
		});
		currentY += lineHeight;

		page.drawText(
			"Pre-printed overstock and black label items to pick from shelves.",
			{
				x: marginX,
				y: toY(currentY + smallFontSize),
				size: smallFontSize,
				font: fontItalic,
				color: rgb(0.4, 0.4, 0.4),
			},
		);
		currentY += lineHeight * 1.5;

		// Draw headers
		drawStockRow(stockHeaders, true);

		// Draw stock rows
		for (const stockItem of stockItems) {
			if (currentY > pageHeight - marginY - 30) {
				addNewPage();
				drawStockRow(stockHeaders, true);
			}

			const rowData = [
				`${stockItem.productName} - ${stockItem.productVariantTitle}`,
				stockItem.isBlackLabel ? "Black Label" : "Overstock",
				stockItem.onHand.toString(),
				stockItem.requiredQuantity.toString(),
				stockItem.toPick.toString(),
				"___",
			];

			drawStockRow(rowData, false);
		}
	} else {
		page.drawText("No premade stock items required for this session.", {
			x: marginX,
			y: toY(currentY + bodyFontSize),
			size: bodyFontSize,
			font: fontItalic,
			color: rgb(0.4, 0.4, 0.4),
		});
		currentY += lineHeight * 2;
	}

	// Add final page number
	page.drawText(`${pageNumber}`, {
		x: pageWidth - 60,
		y: marginY,
		size: smallFontSize,
		font,
	});

	const pdfBytes = await pdfDoc.save();
	return { data: Buffer.from(pdfBytes), error: null };
};
