import { PaginationController } from "@/components/pagination-controller";
import { db } from "@/lib/clients/db";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { orderHolds } from "@drizzle/schema";
import { count, ilike, desc, isNull, isNotNull, and, or } from "drizzle-orm";
import { Search } from "@/components/inputs/search";
import { MultiSelectFilter } from "@/components/inputs/multi-select-filter";
import { OrderHoldsTable } from "@/components/table/order-holds-table";
import { BackButton } from "@/components/nav/back-button";

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Resolved", value: "resolved" },
];

export default async function OrderHoldsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string | string[];
  }>;
}) {
  await authorizePageUser("orders");

  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const pageSize = 100;
  const offset = (page - 1) * pageSize;
  const searchQuery = params.q?.trim();

  // Handle status filter (can be string or array)
  const statusParam = params.status;
  const statusFilters = statusParam ? (Array.isArray(statusParam) ? statusParam : [statusParam]) : [];

  // Normalize search query (add # prefix if it's a number)
  let normalizedQuery = searchQuery;
  if (searchQuery && Number.isInteger(Number(searchQuery)) && searchQuery.length <= 6) {
    normalizedQuery = `#${searchQuery}`;
  }

  // Build where conditions
  const buildWhereConditions = () => {
    const conditions = [];

    // Search filter
    if (normalizedQuery) {
      conditions.push(ilike(orderHolds.orderNumber, `%${normalizedQuery}%`));
    }

    // Status filter
    if (statusFilters.length > 0 && statusFilters.length < 2) {
      // Only apply filter if one status is selected (not both)
      if (statusFilters.includes("active") && !statusFilters.includes("resolved")) {
        conditions.push(isNull(orderHolds.resolvedAt));
      } else if (statusFilters.includes("resolved") && !statusFilters.includes("active")) {
        conditions.push(isNotNull(orderHolds.resolvedAt));
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  };

  const whereCondition = buildWhereConditions();

  // Run queries in parallel for performance
  const [holds, totalHolds] = await Promise.all([
    db
      .select()
      .from(orderHolds)
      .where(whereCondition)
      .orderBy(desc(orderHolds.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(orderHolds)
      .where(whereCondition)
      .then((res) => res[0].count),
  ]);

  const totalPages = Math.ceil(totalHolds / pageSize) || 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/orders" />
          <h1 className="page-title">Order Holds</h1>
        </div>
      </div>
      <div className="page-subtitle">Manage orders on hold</div>

      <div className="mt-4 flex md:flex-row flex-col gap-4 justify-between items-start md:items-center mb-6">
        <div className="flex items-center gap-2">
          <Search placeholder="Search by order number" />
          <MultiSelectFilter title="Status" options={STATUS_OPTIONS} queryParam="status" />
        </div>
      </div>

      <OrderHoldsTable holds={holds} />

      {totalPages > 1 && (
        <PaginationController totalPages={totalPages} total={totalHolds} currentPage={page} className="pt-6" />
      )}
    </div>
  );
}
