import { Search } from "@/components/inputs/search";
import { OrdersTable } from "@/components/table/orders-table";

import type { SearchParams } from "next/dist/server/request/search-params";
import { db } from "@/lib/clients/db";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { PaginationController } from "@/components/pagination-controller";

const PAGE_SIZE = 50;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await authorizePageUser("orders");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (value && typeof value === "string") {
      params.append(key, value);
    }
  }

  let q = params.get("q");
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  if (q?.length && Number.isInteger(Number(q)) && q?.length <= 6) {
    q = `#${q}`;
  }

  const whereClause = q
    ? {
        OR: [
          {
            displayCustomerName: {
              ilike: `%${q}%`,
            },
          },
          {
            name: {
              ilike: `%${q}%`,
            },
          },
          {
            id: {
              ilike: `%${q}%`,
            },
          },
        ],
      }
    : undefined;

  const [orders, totalResult] = await Promise.all([
    db.query.orders.findMany({
      limit: PAGE_SIZE,
      offset,
      orderBy: { createdAt: "desc" },
      where: whereClause,
    }),
    db.query.orders.findMany({
      columns: { id: true },
      where: whereClause,
    }),
  ]);

  const total = totalResult.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="page-title">Orders</h1>
      <div className="page-subtitle">Manage customer orders</div>

      <div className="mt-4 flex md:flex-row flex-col gap-4 justify-between items-start md:items-center">
        <div className="flex items-center gap-2">
          <Search placeholder="Search orders" />
        </div>
        <Link href="/holds" className={buttonVariants({ variant: "fill" })}>
          <Icon icon="ph:call-bell" />
          View Order Holds
        </Link>
      </div>

      <div className="mt-4" />

      <OrdersTable orders={orders || []} />

      {totalPages > 1 && (
        <PaginationController
          total={total}
          totalPages={totalPages}
          currentPage={page}
          className="mt-4"
        />
      )}
    </div>
  );
}
