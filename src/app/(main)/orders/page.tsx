import { Search } from "@/components/inputs/search";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { MultiSelectFilter } from "@/components/inputs/multi-select-filter";

import { OrdersTable } from "@/components/table/orders-table";

import { env } from "@/lib/env";
import { cookies } from "next/headers";
import type { SearchParams } from "next/dist/server/request/search-params";
import { db } from "@/lib/clients/db";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await getUserOrSignout();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (value && typeof value === "string") {
      params.append(key, value);
    }
  }

  const q = params.get("q");

  const orders = await db.query.orders.findMany({
    limit: 50,
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    where: q
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
      : undefined,
  });

  return (
    <div>
      <h1 className="page-title">Orders</h1>
      <div className="page-subtitle">Manage customer orders</div>
      <div className="mt-4 flex md:flex-row flex-col gap-4 justify-between items-start md:items-center">
        <div className="flex items-center gap-2">
          <Search placeholder="Search orders" />
        </div>
      </div>

      <div className="mt-4" />

      <OrdersTable orders={orders || []} />
    </div>
  );
}
