import { SessionController } from "@/components/controllers/session-controller";
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Sessions</h1>
      </div>
      <SessionController orders={session?.orders.map((order) => ({
        ...order,
        // placeholder for now
        isInShippingDoc: true
      })) || []} sessionId={session?.id} />
    </div>
  );
}
