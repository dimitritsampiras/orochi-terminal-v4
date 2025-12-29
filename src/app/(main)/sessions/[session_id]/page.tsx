import { ActiveBadge } from "@/components/badges/active-badge";
import { SessionController } from "@/components/controllers/session-controller";
import { BackButton } from "@/components/nav/back-button";
import { SessionDocumentsTable } from "@/components/table/session-documents-table";
import { SessionOrdersTable } from "@/components/table/session-orders-table";
import { db } from "@/lib/clients/db";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { Icon } from "@iconify/react";
import dayjs from "dayjs";

export default async function SessionPage({ params }: { params: Promise<{ session_id: string }> }) {
  const user = await getUserOrSignout();
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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <BackButton fallbackHref="/sessions" />
          <h1 className="page-title">Session {session?.id}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <ActiveBadge status={session?.active} />
        <div className="flex items-center gap-2 text-xs">
          <Icon icon="ph:calendar-blank" />
          Created at {dayjs(session?.createdAt).format("MMMM DD, YYYY")}
        </div>
      </div>
      <SessionController
        orders={
          session?.orders.map((order) => {
            const isInLatestMergedPackingSlip = session?.batchDocuments.some(
              (document) =>
                document.documentType === "merged_label_slips" &&
                document.batchId === session?.id &&
                document.mergedPdfOrderIds?.includes(order.id)
            );
            return {
              ...order,
              // placeholder for now
              isInShippingDoc: isInLatestMergedPackingSlip,
            };
          }) || []
        }
        session={session}
        batchDocuments={session?.batchDocuments || []}
        userRole={user.role}
      />
    </div>
  );
}
