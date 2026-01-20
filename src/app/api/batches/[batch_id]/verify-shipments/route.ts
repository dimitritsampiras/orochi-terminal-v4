import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { batches } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
	_req: Request,
	{ params }: { params: { batch_id: string } },
) {
	try {
		const user = authorizeApiUser(["super_admin", "admin"]);

		if (!user) {
			return NextResponse.json(
				{ data: null, error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const { batch_id } = await params;
		const batchId = parseInt(batch_id, 10);

		if (Number.isNaN(batchId)) {
			return NextResponse.json(
				{ data: null, error: "Invalid batch ID" },
				{ status: 400 },
			);
		}

		const session = await db.query.batches.findFirst({
			where: {
				id: batchId,
			},
		});

		if (!session) {
			return NextResponse.json(
				{ data: null, error: "Session not found" },
				{ status: 404 },
			);
		}

		if (session.shipmentsVerifiedAt) {
			return NextResponse.json(
				{ data: null, error: "Shipments already verified" },
				{ status: 400 },
			);
		}

		await db
			.update(batches)
			.set({ shipmentsVerifiedAt: new Date() })
			.where(eq(batches.id, batchId));

		return NextResponse.json({ data: "success", error: null });
	} catch (error) {
		console.error("Error verifying shipments:", error);
		return NextResponse.json(
			{ data: null, error: "Failed to verify shipments" },
			{ status: 500 },
		);
	}
}
