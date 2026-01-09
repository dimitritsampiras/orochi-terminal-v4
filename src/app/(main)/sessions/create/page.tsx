import { CreateSessionController } from "@/components/controllers/create-session-controller";
import { OrdersTable } from "@/components/table/orders-table";
import { db } from "@/lib/clients/db";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { getOrderQueue } from "@/lib/core/orders/get-order-queue";

export default async function CreateSessionPage() {
  await authorizePageUser("sessions");

  const [queue, blankVariants] = await Promise.all([
    getOrderQueue(),
    db.query.blankVariants.findMany({
      with: {
        blank: true,
      },
    }),
  ]);

  if (!queue) {
    return <div>Error getting order queue</div>;
  }

  return (
    <div>
      <h1 className="page-title">Create Session</h1>
      <CreateSessionController queue={queue} blankVariants={blankVariants} />
    </div>
  );
}
