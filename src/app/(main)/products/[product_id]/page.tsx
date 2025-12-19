import { IdCopyBadge } from "@/components/badges/id-copy-badge";
import { ProductStatusBadge } from "@/components/badges/product-status-badge";

import { ProductMediaGrid } from "@/components/cards/product-media";
import { ProductVariants } from "@/components/cards/product-variants";
import { SyncBlankToProduct } from "@/components/cards/sync-blank-to-product";

import { db } from "@/lib/clients/db";
import shopify from "@/lib/clients/shopify";

import { productMediaQuery, productQuery } from "@/lib/graphql/product.graphql";

import { buildResourceGid } from "@/lib/utils";
import { Icon } from "@iconify/react";
import dayjs from "dayjs";

export default async function ProductPage({ params }: { params: Promise<{ product_id: string }> }) {
  const { product_id } = await params;

  const gid = buildResourceGid("Product", product_id);

  const [shopifyProduct, databaseProduct, shopifyMedia] = await Promise.all([
    shopify.request(productQuery, {
      variables: {
        id: gid,
      },
    }),
    db.query.products.findFirst({
      where: { id: gid },
      with: {
        productVariants: true,
        blankVariants: true,
        blank: true,
        prints: true,
      },
    }),
    shopify.request(productMediaQuery, {
      variables: {
        query: `product_id:${product_id}`,
      },
    }),
  ]);

  const product = shopifyProduct.data?.product;
  const media = shopifyMedia.data?.files?.edges;

  if (!product) {
    throw Error("Something went wrong fetching the product");
  }

  if (!databaseProduct) {
    throw Error("Something went wrong fetching the database product");
  }

  return (
    <div>
      <h1 className="page-title">Product {product.title}</h1>
      <div className="flex items-center gap-2 mt-3">
        <IdCopyBadge id={product.id} />
        <div className="flex items-center gap-2 text-xs">
          <Icon icon="ph:calendar-blank" />
          Created at {dayjs(product.createdAt).format("MMMM DD, YYYY")}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <ProductStatusBadge status={product.status} />
      </div>

      <div className="mb-24 mt-4 grid-cols-[2fr_1fr] gap-4 md:grid">
        <div className="flex flex-col gap-4">
          {/* MEDIA IMAGES */}
          {media && <ProductMediaGrid media={media} product={product} />}
          <ProductVariants
            product={databaseProduct}
            variants={product.variants.nodes}
            databaseVariants={databaseProduct?.productVariants || []}
            productBlankVariants={databaseProduct?.blankVariants}
            blank={databaseProduct?.blank}
            prints={databaseProduct?.prints || []}
          />
          {/* <ShippingInfo orderId={order.id} orderShipmentData={shipmentData} /> */}
          {/* <OrderLogs logs={logs || []} className="sm:block hidden" /> */}
        </div>
        <div className="flex flex-col gap-4 sm:mt-0 mt-4">
          <SyncBlankToProduct product={databaseProduct} blank={databaseProduct.blank} />

          {/* <OrderLogs logs={logs || []} className="sm:hidden block" /> */}
        </div>
      </div>
    </div>
  );
}
