"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { LineItemStatusBadge } from "@/components/badges/line-item-status-badge";
import { parseGid } from "@/lib/utils";
import type { lineItems } from "@drizzle/schema";

interface ShopifyLineItem {
  id: string;
  name: string;
  quantity: number;
  unfulfilledQuantity: number;
  image?: { url?: string } | null;
}

interface PackagerLineItemCardProps {
  orderId: string;
  shopifyItem: ShopifyLineItem;
  dbItem: typeof lineItems.$inferSelect;
}

export function PackagerLineItemCard({ orderId, shopifyItem, dbItem }: PackagerLineItemCardProps) {
  const [isPackaged, setIsPackaged] = useState(dbItem.markedAsPackaged);
  const [isLoading, setIsLoading] = useState(false);

  const getFullResImage = (url?: string) => {
    if (!url) return undefined;
    // Remove Shopify size suffix like _100x100
    return url.replace(/_\d+x\d+\./, ".");
  };

  const handleTogglePackaged = async () => {
    const newValue = !isPackaged;
    
    // Optimistically update immediately
    setIsPackaged(newValue);
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/orders/${parseGid(orderId)}/line-items/${parseGid(shopifyItem.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markedAsPackaged: newValue }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update");
      }

      toast.success(newValue ? "Marked as packaged" : "Unmarked as packaged");
    } catch {
      // Revert on error
      setIsPackaged(!newValue);
      toast.error("Failed to update packaging status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-lg sm:min-w-lg">
      <CardHeader>
        <div className="gap-2 flex items-center justify-between">
          <div className="gap-2 flex flex-col">
            <CardTitle>{shopifyItem.name}</CardTitle>
            <CardDescription>Quantity: {shopifyItem.quantity}</CardDescription>
          </div>
          <div className="gap-2 flex items-center">
            {isPackaged && (
              <Badge variant="outline">
                <div className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                packaged
              </Badge>
            )}
            <LineItemStatusBadge status={dbItem.completionStatus} />
          </div>
        </div>
        {shopifyItem.quantity > 1 && (
          <Alert className="mt-2 text-amber-600">
            <Icon icon="ph:warning" className="size-4" />
            <AlertTitle>Order requires {shopifyItem.quantity} of this items</AlertTitle>
            <AlertDescription>
              {shopifyItem.name} is required to be packaged {shopifyItem.quantity} times.
            </AlertDescription>
          </Alert>
        )}
        {shopifyItem.unfulfilledQuantity <= 0 && (
          <Alert className="mt-2 text-red-600">
            <Icon icon="ph:warning" className="size-4" />
            <AlertTitle>Line item is not fulfillable</AlertTitle>
            <AlertDescription>
              {shopifyItem.name} is not fulfillable. The order has likely already been fulfilled.
            </AlertDescription>
          </Alert>
        )}
        <div className="mt-2 w-full">
          <Button
            disabled={shopifyItem.unfulfilledQuantity <= 0}
            className="w-full"
            size="lg"
            variant={isPackaged ? "outline" : "default"}
            onClick={handleTogglePackaged}
            loading={isLoading}
          >
            {isPackaged ? "Unmark as Packaged" : "Mark as Packaged"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative">
        {shopifyItem.image?.url ? (
          <Image
            src={getFullResImage(shopifyItem.image?.url) || ""}
            alt={shopifyItem.name}
            width={4000}
            height={4000}
            className="w-full h-auto aspect-square object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gray-100 rounded-md flex flex-col items-center justify-center">
            <Icon icon="ph:image" className="size-4 text-gray-500" />
            <p className="text-sm text-gray-500">No image available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

