import { Search } from "@/components/inputs/search";
import { db } from "@/lib/clients/db";
import { ProductsTable } from "@/components/table/products-table";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { PaginationController } from "@/components/pagination-controller";

const PAGE_SIZE = 50;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string[] }>;
}) {
  await authorizePageUser("products");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (value && typeof value === "string") {
      params.append(key, value);
    }
  }

  const q = params.get("q");
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const whereClause = q
    ? {
        OR: [
          {
            title: {
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

  const [products, totalResult] = await Promise.all([
    db.query.products.findMany({
      limit: PAGE_SIZE,
      offset,
      with: {
        productVariants: true,
      },
      orderBy: { createdAt: "desc" },
      where: whereClause,
    }),
    db.query.products.findMany({
      columns: { id: true },
      where: whereClause,
    }),
  ]);

  const total = totalResult.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="page-title">Products</h1>
      <div className="page-subtitle">Manage physical products</div>
      <div className="my-4 flex md:flex-row flex-col gap-4 justify-between items-start md:items-center">
        <div className="flex items-center gap-2">
          <Search placeholder="Search products" />
        </div>
        <div>{/* <CreateProductForm categories={categories} /> */}</div>
      </div>
      <ProductsTable products={products} />

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
