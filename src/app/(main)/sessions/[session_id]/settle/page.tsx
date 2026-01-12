import { db } from "@/lib/clients/db";
// import { calculateSettlement } from "@/lib/core/session/calculate-settlement";
import { SettleSessionController } from "@/components/controllers/settle-session-controller";
import { BackButton } from "@/components/nav/back-button";
import { notFound } from "next/navigation";
import { getSettlementData } from "@/lib/core/session/get-settlement-data";

export default async function SettleSessionPage({ params }: { params: Promise<{ session_id: string }> }) {
  const { session_id } = await params;
  const batchId = parseInt(session_id, 10);

  if (isNaN(batchId)) {
    notFound();
  }

  // Get batch info
  const batch = await db.query.batches.findFirst({
    where: { id: batchId },
  });

  if (!batch) {
    notFound();
  }

  // Calculate initial settlement data
  const {data: settlementData, error} = await getSettlementData(batchId);

  if (error || !settlementData) {
    notFound();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallbackHref={`/sessions/${batchId}`} />
        <div>
          <h1 className="page-title">Settle Session {batchId}</h1>
          <p className="text-sm text-muted-foreground">
            Created: {batch.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      <SettleSessionController initialData={settlementData} batchId={batchId} />
    </div>
  );
}
