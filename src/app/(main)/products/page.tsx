import { MultiSelectFilter } from "@/components/inputs/multi-select-filter";
import { Search } from "@/components/inputs/search";
import { env } from "@/lib/env";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { db } from "@/lib/clients/db";
import { ProductsTable } from "@/components/table/products-table";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";

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

  const products = await db.query.products.findMany({
    limit: 50,
    with: {
      productVariants: true,
    },
    orderBy: { createdAt: "desc" },
    where: q
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
      : undefined,
  });

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
    </div>
  );
}
