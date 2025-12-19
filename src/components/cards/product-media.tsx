import { productQuery } from "@/lib/graphql/product.graphql";
import { ProductQuery } from "@/lib/types/admin.generated";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type Product = NonNullable<ProductQuery["product"]>;

export const ProductMediaGrid = ({ media, product }: { media: any[]; product: Product }) => {
  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-2 row-span-2">
        <img
          className="border shadow-sm rounded-md"
          style={{ aspectRatio: "3/4" }}
          src={product.featuredMedia?.preview?.image?.url}
          alt={product.title}
        />
      </div>
      {media &&
        media.length > 0 &&
        media
          .filter(({ node }: { node: any }) => {
            return node.image.id !== product.featuredMedia?.preview?.image?.id;
          })
          .slice(0, 8)
          .map(({ node }: { node: any }) => {
            // MediaImage stores url in node.image.url, GenericFile in node.url
            const url = node.image?.url || node.url;

            // Skip videos or nodes without a URL
            if (!url) return null;

            return (
              <div key={node.id} className="relative w-full">
                <img
                  src={url}
                  alt={node.alt || "Product media"}
                  className="h-full w-full object-cover border shadow-sm rounded-md col-span-1 row-span-1"
                />
              </div>
            );
          })}
    </div>
  );
};
