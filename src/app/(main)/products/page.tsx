import CreateProductForm from '@/components/forms/product-forms/create-product-form';
import { MultiSelectFilter } from '@/components/inputs/multi-select-filter';
import { Search } from '@/components/inputs/search';
// import { ProductsTable } from '@/components/table/products-table';
import { env } from '@/lib/env';
import { getUserOrSignout } from '@/lib/core/auth/get-user-or-signout';
// import type {
//   GetCategoriesResponse,
//   GetLocationsResponse,
//   GetProductsResponse
// } from '@/lib/types/api';

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string[] }>;
}) {
  const { page, q, status } = await searchParams;

  const productsUrl = new URL(`${env.SERVER_URL}/api/products`);
  if (page) productsUrl.searchParams.set('page', page);
  if (q) productsUrl.searchParams.set('q', q);
  for (const s of status ?? []) {
    productsUrl.searchParams.append('status', s);
  }

  const userId = await getUserOrSignout();

  // const [productsResponse, categoriesResponse, locationsResponse] = await Promise.all([
  //   fetch(productsUrl.toString()).then((res) => res.json() as Promise<GetProductsResponse>),
  //   fetch(`${env.SERVER_URL}/api/categories`).then(
  //     (res) => res.json() as Promise<GetCategoriesResponse>
  //   ),
  //   fetch(`${env.SERVER_URL}/api/locations`).then(
  //     (res) => res.json() as Promise<GetLocationsResponse>
  //   )
  // ]);

  // const { data: productsData } = productsResponse;
  // const { data: categories } = categoriesResponse;
  // const { data: locations } = locationsResponse;

  // if (!productsData || !categories || !locations) {
  //   throw new Error('Failed to fetch products, categories or locations');
  // }

  return (
    <div>
      <h1 className="page-title">Products</h1>
      <div className="page-subtitle">Manage physical products</div>
      <div className="my-4 flex md:flex-row flex-col gap-4 justify-between items-start md:items-center">
        <div className="flex items-center gap-2">
          <Search placeholder="Search products" />
          <MultiSelectFilter
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' }
            ]}
            queryParam="status"
            title="Status"
          />
        </div>
        <div>
          {/* <CreateProductForm categories={categories} /> */}
        </div>
      </div>
      {/* <ProductsTable
        pagination={productsData.pagination}
        products={productsData.products}
        locs={locations}
        categories={categories}
      /> */}
    </div>
  );
}
