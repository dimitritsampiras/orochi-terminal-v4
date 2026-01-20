import { db } from "@/lib/clients/db";
import { getLineItemsByBatchId } from "@/lib/core/session/get-session-line-items";
import { createSortedAssemblyLine } from "@/lib/core/session/create-assembly-line";
import { getPremadeStockRequirements } from "@/lib/core/session/get-premade-stock-requirements";
import type { DataResponse } from "@/lib/types/misc";
import { batches } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/batches/[batch_id]/start
 * Preview the session start
 */
export async function GET(
	_req: Request,
	{ params }: { params: { batch_id: string } },
) {
	const { batch_id } = await params;
	const batchId = Number.parseInt(batch_id, 10);
	if (Number.isNaN(batchId)) {
		return NextResponse.json(
			{ data: null, error: "Invalid batch ID" },
			{ status: 400 },
		);
	}

	const { data, error } = await getLineItemsByBatchId(batchId);

	if (!data) {
		return NextResponse.json(
			{ data: null, error: error ?? "Failed to get line items" },
			{ status: 500 },
		);
	}

	const { items: premadeStockItems, malformedItems } = getPremadeStockRequirements(
		data.lineItems,
	);

	const assemblyResult = await createSortedAssemblyLine(
		batchId,
		data.lineItems,
		premadeStockItems,
	);

	if (!assemblyResult.data) {
		return NextResponse.json(
			{ data: null, error: assemblyResult.error ?? "Failed to create preview" },
			{ status: 500 },
		);
	}

	const { assemblyLine, pickingRequirements } = assemblyResult.data;

	return NextResponse.json({
		data: {
			filteredItems: data.filteredLineItems,
			assemblyLine: assemblyLine.map((item) => ({
				id: item.id,
				name: item.name,
				orderName: item.order.name,
				fulfillmentType: pickingRequirements.fulfillmentMap[item.id] ?? "print",
				position: item.itemPosition,
			})),
      malformedItems,
			pickingRequirements: pickingRequirements.requirements,
		},
		error: null,
	});
}

export async function POST(
	_req: Request,
	{ params }: { params: { batch_id: string } },
): Promise<NextResponse<DataResponse<"success">>> {
	const { batch_id } = await params;
	const batchId = Number.parseInt(batch_id, 10);
	if (Number.isNaN(batchId)) {
		return NextResponse.json(
			{ data: null, error: "Invalid batch ID" },
			{ status: 400 },
		);
	}

	const session = await db.query.batches.findFirst({
		where: { id: batchId },
	});

	if (!session) {
		return NextResponse.json(
			{ data: null, error: "Session not found" },
			{ status: 404 },
		);
	}

	if (!session.premadeStockVerifiedAt) {
		return NextResponse.json(
			{ data: null, error: "Premade stock must be verified before starting" },
			{ status: 400 },
		);
	}

	if (!session.blankStockVerifiedAt) {
		return NextResponse.json(
			{ data: null, error: "Blank stock must be verified before starting" },
			{ status: 400 },
		);
	}

	const { data, error } = await getLineItemsByBatchId(batchId);

	if (!data) {
		return NextResponse.json(
			{ data: null, error: error ?? "Failed to get line items" },
			{ status: 500 },
		);
	}

	const { items: premadeStockItems } = getPremadeStockRequirements(
		data.lineItems,
	);

	const assemblyResult = await createSortedAssemblyLine(
		batchId,
		data.lineItems,
		premadeStockItems,
	);

	if (!assemblyResult.data) {
		return NextResponse.json(
			{ data: null, error: assemblyResult.error ?? "Failed to create assembly line" },
			{ status: 500 },
		);
	}

	const { assemblyLine, pickingRequirements } = assemblyResult.data;

	const assemblyLineJson = JSON.stringify(
		assemblyLine.map((item) => ({
			id: item.id,
			itemPosition: item.itemPosition,
		})),
	);

	const pickingListJson = JSON.stringify(pickingRequirements.requirements);

	await db
		.update(batches)
		.set({
			assemblyLineJson,
			pickingListJson,
			active: true,
			startedAt: new Date(),
		})
		.where(eq(batches.id, batchId));

	return NextResponse.json({ data: "success", error: null });
}
