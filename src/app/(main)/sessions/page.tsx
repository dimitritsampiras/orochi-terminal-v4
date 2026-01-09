import { PaginationController } from "@/components/pagination-controller";
import { SessionsTable } from "@/components/table/sessions-table";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/clients/db";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { batches } from "@drizzle/schema";
import { count } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

//

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
  }>;
}) {
  await authorizePageUser("sessions");

  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // Run queries in parallel for performance
  const [sessions, totalBatches] = await Promise.all([
    db.query.batches.findMany({
      limit: pageSize,
      offset: offset,
      orderBy: { createdAt: "desc" },
      with: {
        orders: {
          columns: {
            id: true,
            displayFulfillmentStatus: true,
          },
        },
      },
    }),
    db
      .select({ count: count() })
      .from(batches)
      .then((res) => res[0].count),
  ]);

  const totalPages = Math.ceil(totalBatches / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Sessions</h1>
        <Link href="/sessions/create" className={buttonVariants()}>
          Create Session
        </Link>
      </div>
      <SessionsTable sessions={sessions || []} />
      <PaginationController totalPages={totalPages} total={totalBatches} currentPage={page} className="pt-6" />
    </div>
  );
}
