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

  const { data, error } = await getSettlementData(batchId);

  if (error || !data) {
    notFound();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BackButton fallbackHref={`/sessions/${batchId}`} />
        <div>
          <h1 className="page-title">Session {batchId} Overview</h1>
          {data.batch.startedAt && (
            <p className="text-sm text-muted-foreground">
              Started: {data.batch.startedAt.toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <SettleSessionController initialData={data.items} batchId={batchId} />
    </div>
  );
}
