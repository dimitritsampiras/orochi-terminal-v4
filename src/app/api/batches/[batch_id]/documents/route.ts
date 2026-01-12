import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { generateSessionDocumentsSchema } from "@/lib/schemas/batch-schema";
import { NextRequest, NextResponse } from "next/server";
import { generateSessionDocuments } from "@/lib/core/session/generate-session-documents";
import { GenerateSessionDocumentsResponse } from "@/lib/types/api";

/**
 * POST /api/batches/[batch_id]/documents
 *
 * Generates both picking list and assembly list PDFs together.
 * These documents must always be generated as a pair to ensure consistency.
 *
 * Also stores:
 * - assemblyLineJson: the sort order snapshot (so it doesn't change when line item data changes)
 * - pickingListJson: line-item level requirements (for settlement comparison)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batch_id: string }> }
): Promise<NextResponse<GenerateSessionDocumentsResponse>> {
  const user = await authorizeApiUser(["super_admin", "admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { batch_id } = await params;
  const batchId = parseInt(batch_id);

  if (isNaN(batchId)) {
    return NextResponse.json({ data: null, error: "Invalid batch ID" }, { status: 400 });
  }

  // Validate request body (currently empty schema, but here for future extensibility)
  const body = await request.json();
  const parsed = generateSessionDocumentsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
  }

  try {
    const result = await generateSessionDocuments(batchId);
    if (!result.data) {
      return NextResponse.json(
        { data: null, error: result.error ?? "Failed to generate session documents" },
        { status: 500 }
      );
    }
    return NextResponse.json({ data: result.data, error: null }, { status: 200 });
  } catch (error) {
    console.error("Error creating documents:", error);
    return NextResponse.json(
      { data: null, error: error instanceof Error ? error.message : "Failed to create documents" },
      { status: 500 }
    );
  }
}
