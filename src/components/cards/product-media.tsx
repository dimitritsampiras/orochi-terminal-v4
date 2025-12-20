"use client";

import { Expand } from "lucide-react";
import { ProductQuery } from "@/lib/types/admin.generated";
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { DialogTitle } from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

type Product = NonNullable<ProductQuery["product"]>;

const MediaImage = ({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) => {
  return (
    <Dialog>
      <div className="relative group">
        <img src={src} alt={alt} className={cn("border shadow-sm rounded-md", className)} style={style} />
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="absolute top-2 right-2 size-7">
            <Expand className="size-3 text-zinc-500" />
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent className="max-w-4xl p-2">
        <DialogHeader className="sr-only">
          <DialogTitle>Product Media</DialogTitle>
        </DialogHeader>
        <img src={src} alt={alt} className="w-full h-auto rounded-md" />
      </DialogContent>
    </Dialog>
  );
};

export const ProductMediaGrid = ({ media, product }: { media: any[]; product: Product }) => {
  const featuredImageUrl = product.featuredMedia?.preview?.image?.url;

  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-2 row-span-2">
        {featuredImageUrl && (
          <MediaImage src={featuredImageUrl} alt={product.title} style={{ aspectRatio: "3/4" }} />
        )}
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
              <MediaImage
                key={node.id}
                src={url}
                alt={node.alt || "Product media"}
                className="h-full w-full object-cover"
              />
            );
          })}
    </div>
  );
};
