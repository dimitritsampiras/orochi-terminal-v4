import type { DataResponse } from "@/lib/types/misc";
import type { batches, garmentSize } from "@drizzle/schema";
import dayjs from "dayjs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SessionLineItem } from "../session/get-session-line-items";
import { getBlankStockRequirements } from "../session/get-blank-stock-requirements";
import type { PremadeStockItem } from "../session/get-premade-stock-requirements";

type Batch = typeof batches.$inferSelect;
type GarmentSize = (typeof garmentSize.enumValues)[number];

// Convert db size to display size (e.g., "sm" -> "Small", "2xl" -> "2XL")
const formatSize = (size: GarmentSize): string => {
	const map: Record<GarmentSize, string> = {
		xs: "XSmall",
		sm: "Small",
		md: "Medium",
		lg: "Large",
		xl: "XLarge",
		"2xl": "2XL",
		"3xl": "3XL",
		"4xl": "4XL",
		"5xl": "5XL",
		os: "One Size",
	};
	return map[size] ?? size;
};

// Capitalize first letter of each word
const capitalizeColor = (color: string): string => {
	return color
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
};

// Get color sort priority (black first, white second, then alphabetically)
const getColorSortPriority = (color: string): number => {
	const lower = color.toLowerCase();
	if (lower === "black") return 0;
	if (lower === "white") return 1;
	return 2;
};

// Size order for sorting
const sizeOrder: GarmentSize[] = [
	"xs",
	"sm",
	"md",
	"lg",
	"xl",
	"2xl",
	"3xl",
	"4xl",
	"5xl",
	"os",
];
const getSizeIndex = (size: GarmentSize): number => {
	const idx = sizeOrder.indexOf(size);
	return idx === -1 ? 999 : idx;
};

export const generateBlankPickingList = async (
	sessionLineItems: SessionLineItem[],
	batch: Pick<Batch, "id" | "createdAt" | "active">,
	premadeStockItems: PremadeStockItem[],
): Promise<DataResponse<Buffer>> => {
	const { items, malformedItems } = getBlankStockRequirements(
		sessionLineItems,
		premadeStockItems,
	);

	// Sort by: color priority (black first, white second, rest alphabetically) -> garmentType -> blankName -> size
	const blankItems = items.sort((a, b) => {
		// 1. Color priority
		const colorPriorityA = getColorSortPriority(a.color);
		const colorPriorityB = getColorSortPriority(b.color);
		if (colorPriorityA !== colorPriorityB)
			return colorPriorityA - colorPriorityB;
		// If both are in "rest" category, sort alphabetically
		if (colorPriorityA === 2 && colorPriorityB === 2) {
			const colorCompare = a.color.localeCompare(b.color);
			if (colorCompare !== 0) return colorCompare;
		}

		// 2. Garment type
		const garmentCompare = a.garmentType.localeCompare(b.garmentType);
		if (garmentCompare !== 0) return garmentCompare;

		// 3. Blank name
		const nameCompare = a.blankName.localeCompare(b.blankName);
		if (nameCompare !== 0) return nameCompare;

		// 4. Size (by natural size order)
		return getSizeIndex(a.size) - getSizeIndex(b.size);
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

	// Blank table headers and column widths
	const blankHeaders = [
		"Blank",
		"Color / Size",
		"Type",
		"On Hand",
		"Req.",
		"To Pick",
		"Check",
	];
	const blankColWidths = [155, 95, 60, 50, 45, 45, 35];
	const fadedColumns = [3, 4]; // On Hand and Required are faded

	// Helper to draw a blank row
	const drawBlankRow = (rowItems: string[], isBold: boolean = false) => {
		const currentFont = isBold ? fontBold : font;
		let xOffset = marginX;

		rowItems.forEach((item, i) => {
			let displayText = item;
			const maxWidth = blankColWidths[i] - 4;
			let textWidth = currentFont.widthOfTextAtSize(displayText, bodyFontSize);

			while (textWidth > maxWidth && displayText.length > 0) {
				displayText = displayText.slice(0, -1);
				textWidth = currentFont.widthOfTextAtSize(
					`${displayText}…`,
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
			xOffset += blankColWidths[i];
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
	page.drawText("Blank Picking List", {
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

	// ========== MAIN SECTION: Blank Items ==========
	if (blankItems.length > 0) {
		page.drawText("Blanks to Pick", {
			x: marginX,
			y: toY(currentY + sectionFontSize),
			size: sectionFontSize,
			font: fontBold,
		});
		currentY += lineHeight;

		page.drawText(
			"Blank garments needed for printing. Items not covered by premade stock.",
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
		drawBlankRow(blankHeaders, true);

		// Draw blank rows
		for (const blankItem of blankItems) {
			if (currentY > pageHeight - marginY - 30) {
				addNewPage();
				drawBlankRow(blankHeaders, true);
			}

			const rowData = [
				`${blankItem.blankCompany} - ${blankItem.blankName}`,
				`${capitalizeColor(blankItem.color)} - ${formatSize(blankItem.size)}`,
				blankItem.garmentType,
				blankItem.onHand.toString(),
				blankItem.requiredQuantity.toString(),
				blankItem.toPick === 0 ? "-" : blankItem.toPick.toString(),
				"___",
			];

			drawBlankRow(rowData, false);
		}
	} else {
		page.drawText("No blanks required for this session.", {
			x: marginX,
			y: toY(currentY + bodyFontSize),
			size: bodyFontSize,
			font: fontItalic,
			color: rgb(0.4, 0.4, 0.4),
		});
		currentY += lineHeight * 2;
	}

	// ========== SECTION: Unaccounted Items (IGNORE) ==========
	if (malformedItems.length > 0) {
		currentY += lineHeight * 3;

		if (currentY > pageHeight - marginY - 100) {
			addNewPage();
		}

		page.drawText("Unaccounted Items — (ignore)", {
			x: marginX,
			y: toY(currentY + headerFontSize),
			size: headerFontSize,
			font: fontBold,
		});
		currentY += lineHeight;

		page.drawText(
			"These items have missing blank data and cannot be processed. Either ignore or contact admin to fix product setup.",
			{
				x: marginX,
				y: toY(currentY + smallFontSize),
				size: smallFontSize,
				font: fontItalic,
				color: rgb(0.4, 0.4, 0.4),
			},
		);
		currentY += lineHeight * 1.5;

		for (const item of malformedItems) {
			if (currentY > pageHeight - marginY - 30) {
				addNewPage();
			}

			page.drawText(`${item.lineItemName}`, {
				x: marginX,
				y: toY(currentY + bodyFontSize),
				size: bodyFontSize,
				font,
			});

			page.drawText(`(${item.reason})`, {
				x: marginX + 300,
				y: toY(currentY + bodyFontSize),
				size: smallFontSize,
				font,
			});

			currentY += lineHeight;
		}
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
