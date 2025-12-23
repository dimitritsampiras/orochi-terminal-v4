"use client";

import { Expand } from "lucide-react";
import { ProductQuery } from "@/lib/types/admin.generated";
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { DialogTitle } from "@radix-ui/react-dialog";
import { cn, parseGid } from "@/lib/utils";
import { MediaImage as MediaImageType } from "@/lib/types/misc";

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
      <div className={cn("relative group", className)}>
        <img src={src} alt={alt} className={cn("border shadow-sm rounded-md object-contain")} style={style} />
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

export const ProductMediaGrid = ({ media, product }: { media: MediaImageType[]; product: Product }) => {
  const featuredImageUrl = product.featuredMedia?.preview?.image?.url;

  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-2 row-span-2">
        {featuredImageUrl && <MediaImage src={featuredImageUrl} alt={product.title} style={{ aspectRatio: "3/4" }} />}
      </div>
      {media &&
        media.length > 0 &&
        media
          .filter(({ image }: MediaImageType) => {
            return image && image?.id !== product.featuredMedia?.preview?.image?.id;
          })
          .slice(0, 8)
          .map(({ image, alt, id }: MediaImageType) => {
            // MediaImage stores url in node.image.url, GenericFile in node.url
            const url = image?.url;

            // Skip videos or nodes without a URL
            if (!url) return null;

            return (
              <MediaImage key={id} src={url} alt={alt || "Product media"} className="h-full w-full object-cover" />
            );
          })}
    </div>
  );
};

export const AssemblyLineMediaGrid = ({ media, firstId }: { media: MediaImageType[]; firstId?: string }) => {
  const firstIdNumeric = firstId ? parseGid(firstId) : null;

  const sortedMedia = media.toSorted((a, b) => {
    if (firstIdNumeric) {
      // Compare numeric IDs to handle ImageSource vs MediaImage mismatch
      if (parseGid(a.id) === firstIdNumeric) return -1;
      if (parseGid(b.id) === firstIdNumeric) return 1;
    }
    return 0;
  });
  const firstMedia = sortedMedia[0];
  const slicedMedia = sortedMedia.slice(1, 8);

  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-2 row-span-2">
        {firstMedia.image?.url && (
          <MediaImage
            src={firstMedia.image?.url || firstMedia.image.url}
            alt={firstMedia.alt || "Product media"}
            style={{ aspectRatio: "3/4" }}
          />
        )}
      </div>
      {slicedMedia.map(({ image, alt, id }) => {
        // MediaImage stores url in node.image.url, GenericFile in node.url
        const url = image?.url;

        // Skip videos or nodes without a URL
        if (!url) return null;

        return <MediaImage key={id} src={url} alt={alt || "Product media"} className="h-full w-full object-cover" />;
      })}
    </div>
  );
};
