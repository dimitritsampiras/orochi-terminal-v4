
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/clients/db";
import { admin } from "@/lib/clients/supabase-admin";
import { batchDocuments, shipments } from "@drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import dayjs from "dayjs";
import type { PickingRequirement } from "../session/create-picking-requirements";
import type { AssemblyLineItem } from "../session/create-assembly-line";

const PACKING_SLIPS_BASE_URL =
  "https://muihkdbhpgfkahlyyhmo.supabase.co/storage/v1/object/public/packing-slips";

type OrderCategory = "premade_only" | "darks_only" | "other";

const LIGHT_COLORS = [
  "white",
  "natural",
  "bone",
  "cream",
  "ivory",
  "light yellow",
  "banana",
  "yellow",
  "seafoam",
];

/**
 * Determines the category for an order based on its line items' fulfillment types and pretreat
 */
function categorizeOrder(
  orderId: string,
  pickingRequirements: PickingRequirement[],
  assemblyLine: AssemblyLineItem[]
): { category: OrderCategory; maxPosition: number } {
  const orderReqs = pickingRequirements.filter((r) => r.orderId === orderId);
  const orderAssemblyItems = assemblyLine.filter((item) => item.orderId === orderId);

  // Get max assembly position for this order (determines sub-sort order)
  const maxPosition =
    orderAssemblyItems.length > 0
      ? Math.max(...orderAssemblyItems.map((item) => item.itemPosition))
      : Number.MAX_SAFE_INTEGER;

  if (orderReqs.length === 0) {
    return { category: "other", maxPosition };
  }

  // Category 1: All items are stock (premade)
  const allPremade = orderReqs.every((r) => r.expectedFulfillmentType === "stock");
  if (allPremade) {
    return { category: "premade_only", maxPosition };
  }

  // Category 2: All print items are darks (no light colors)
  const printItems = orderReqs.filter((r) => r.expectedFulfillmentType === "print");
  const allDarks =
    printItems.length > 0 &&
    printItems.every((r) => {
      const color = r.blankGarmentColor?.toLowerCase() ?? "";
      return !LIGHT_COLORS.includes(color);
    });

  if (allDarks) {
    return { category: "darks_only", maxPosition };
  }

  return { category: "other", maxPosition };
}

/**
 * Creates a separator page with category label
 */
async function createSeparatorPage(
  pdfDoc: PDFDocument,
  categoryLabel: string
): Promise<void> {
  pdfDoc.addPage([612, 792]);
}

const CATEGORY_LABELS: Record<OrderCategory, string> = {
  premade_only: "PREMADE / STOCK ORDERS",
  darks_only: "DARK PRETREAT ORDERS",
  other: "REMAINING ORDERS",
};

/**
 * Generates a merged PDF of all shipment label slips for a batch,
 * sorted by fulfillment category with separator pages between categories.
 */
export async function generateMergedShipmentPdf(
  batchId: number,
  pickingRequirements: PickingRequirement[],
  assemblyLine: AssemblyLineItem[]
): Promise<{ data: { documentPath: string } | null; error: string | null }> {
  // 1. Get all unique order IDs from the assembly line
  const orderIds = [...new Set(assemblyLine.map((item) => item.orderId))];

  if (orderIds.length === 0) {
    return { data: null, error: "No orders in assembly line" };
  }

  // 2. Get all purchased shipments for these orders
  const batchShipments = await db
    .select()
    .from(shipments)
    .where(inArray(shipments.orderId, orderIds));

  const validShipments = batchShipments.filter(
    (s) => s.labelSlipPath && s.isPurchased && !s.isRefunded
  );

  if (validShipments.length === 0) {
    return { data: null, error: "No valid shipments with label slips found" };
  }

  // 3. Categorize and sort shipments
  const shipmentsWithCategory = validShipments.map((shipment) => {
    const { category, maxPosition } = categorizeOrder(
      shipment.orderId,
      pickingRequirements,
      assemblyLine
    );
    return { shipment, category, maxPosition };
  });

  const categoryOrder: Record<OrderCategory, number> = {
    premade_only: 0,
    darks_only: 1,
    other: 2,
  };

  shipmentsWithCategory.sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;
    return a.maxPosition - b.maxPosition;
  });

  // 4. Create merged PDF with separator pages
  // Fetch PDFs in parallel batches for speed (~10-15s for 150 PDFs vs 45-105s sequential)
  const mergedPdf = await PDFDocument.create();
  const BATCH_SIZE = 30;

  // Fetch all PDFs in parallel batches, preserving order
  const fetchedPdfs: (PDFDocument | null)[] = [];

  for (let i = 0; i < shipmentsWithCategory.length; i += BATCH_SIZE) {
    const batch = shipmentsWithCategory.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async ({ shipment }) => {
        const pdfUrl = `${PACKING_SLIPS_BASE_URL}/${shipment.labelSlipPath}`;

        try {
          const response = await fetch(pdfUrl);
          if (!response.ok) {
            console.error(`Failed to fetch PDF: ${pdfUrl}`);
            return null;
          }
          const pdfBytes = await response.arrayBuffer();
          return await PDFDocument.load(pdfBytes);
        } catch (err) {
          console.error(`Failed to fetch PDF for shipment ${shipment.id}:`, err);
          return null;
        }
      })
    );

    fetchedPdfs.push(...batchResults);
  }

  // Merge PDFs in order with separator pages
  let currentCategory: OrderCategory | null = null;

  for (let i = 0; i < shipmentsWithCategory.length; i++) {
    const { category } = shipmentsWithCategory[i];
    const sourcePdf = fetchedPdfs[i];

    // Add separator page when category changes
    if (currentCategory !== category) {
      await createSeparatorPage(mergedPdf, CATEGORY_LABELS[category]);
      currentCategory = category;
    }

    if (!sourcePdf) continue;

    const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    for (const page of pages) {
      mergedPdf.addPage(page);
    }
  }

  // 5. Save and upload
  const mergedPdfBytes = await mergedPdf.save();
  const fileName = `merged-label-slips/batch-${batchId}-${dayjs().format("YYYYMMDDHHmmss")}.pdf`;

  const { error: uploadError } = await admin.storage
    .from("packing-slips")
    .upload(fileName, Buffer.from(mergedPdfBytes), {
      contentType: "application/pdf",
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return { data: null, error: "Failed to upload merged PDF" };
  }

  // 6. Create document record
  await db.insert(batchDocuments).values({
    name: `Merged Label Slips | Session ${batchId}`,
    documentPath: fileName,
    batchId,
    documentType: "merged_label_slips",
    mergedPdfOrderIds: orderIds,
  });

  return { data: { documentPath: fileName }, error: null };
}