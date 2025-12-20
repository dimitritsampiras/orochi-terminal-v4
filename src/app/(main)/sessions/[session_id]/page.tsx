import { SessionController } from "@/components/controllers/session-controller";
import { BackButton } from "@/components/nav/back-button";
import { SessionOrdersTable } from "@/components/table/session-orders-table";
import { db } from "@/lib/clients/db";

export default async function SessionPage({ params }: { params: Promise<{ session_id: string }> }) {
  const { session_id } = await params;

  const sessionIdAsNumber = parseInt(session_id);

  if (isNaN(sessionIdAsNumber)) {
    throw new Error("Invalid session ID");
  }

  const session = await db.query.batches.findFirst({
    where: {
      id: sessionIdAsNumber,
    },
    with: {
      orders: {
        with: {
          lineItems: true,
          shipments: true,
          orderHolds: true,
        },
      },
      batchDocuments: true,
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BackButton href="/sessions" />
          <h1 className="page-title">Session {session?.id}</h1>
        </div>
      </div>
      <SessionController
        orders={
          session?.orders.map((order) => ({
            ...order,
            // placeholder for now
            isInShippingDoc: true,
          })) || []
        }
        sessionId={session?.id}
      />
    </div>
  );
}
