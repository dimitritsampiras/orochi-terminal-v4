'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { GetProductsResponse, UpdateProductStockResponse } from '@/lib/types/misc';
import { Button, ButtonSpinner } from '../../ui/button';
import { Input } from '../../ui/input';
import type { locations } from '../../../../drizzle/schema';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Product = NonNullable<GetProductsResponse['data']>['products'][number];
type Location = Pick<typeof locations.$inferSelect, 'id' | 'name' | 'address'>;
function EditProductStockForm({
  product,
  locs,
  isOpen,
  onOpenChange
}: {
  product: Product;
  locs: Location[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const [stock, setStock] = useState<
    Record<
      Location['id'],
      {
        stockId?: number;
        value: number;
      }
    >
  >({});

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const stockArray = Object.entries(stock).map(([locationId, data]) => ({
        locationId: Number(locationId),
        value: data.value,
        ...(data.stockId && { stockId: data.stockId })
      }));

      const response = await fetch(`/api/products/${product.id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: stockArray })
      });

      if (response.ok) {
        router.refresh();
        onOpenChange(false);
        toast.success('Stock updated');
      } else {
        const error = (await response.json()) as UpdateProductStockResponse;
        console.log('Create user failed:', error);
        toast.error('Failed to update stock', {
          dismissible: true,
          description: error?.error || 'Failed to update stock',
          descriptionClassName: 'text-zinc-800!'
        });
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (isOpen === false) {
      setStock({});
    } else {
      if (isOpen && product.stock.length > 0) {
        const initialStock: Record<Location['id'], { stockId?: number; value: number }> = {};

        // Initialize with existing stock values
        product.stock.forEach((stockItem) => {
          if (stockItem.locationId) {
            initialStock[stockItem.locationId] = {
              stockId: stockItem.id,
              value: Number(stockItem.value ?? 0)
            };
          }
        });

        setStock(initialStock);
      }
    }
  }, [isOpen, product.stock]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Manage Stock - {product.name}</DialogTitle>
        </DialogHeader>

        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm font-medium">Stock By Location</div>
            <div className="text-sm text-zinc-500">
              {product.stock.reduce((acc, curr) => acc + (curr.value ?? 0), 0)} total units
            </div>
          </div>

          <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto">
            {locs.map((loc, index, locsArr) => {
              const stockForLocation = product.stock.find(
                (stock) => stock.locationId === loc.id
              );
              return (
                <div key={loc.id}>
                  <div className="flex justify-between items-center">
                    <div className="max-w-[300px]">
                      <div className="text-xs">{loc.name}</div>
                      <div className="text-xs text-zinc-500">{loc.address}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-zinc-50 flex items-center h-9 px-2 rounded-md w-[35px] text-xs justify-end">
                        {stockForLocation?.value ?? 0}
                      </div>
                      <div>
                        <Input
                          disabled={isSaving}
                          type="number"
                          min={0}
                          className={cn(
                            'w-[100px]',
                            ((stock[loc.id]?.stockId &&
                              stockForLocation?.id &&
                              stock[loc.id]?.stockId === stockForLocation?.id &&
                              stock[loc.id]?.value === stockForLocation?.value) ||
                              stock[loc.id]?.value === 0) &&
                              'text-zinc-500 bg-zinc-50'
                          )}
                          value={stock[loc.id]?.value ?? 0}
                          onChange={(e) =>
                            setStock((prev) => ({
                              ...prev,
                              [loc.id]: {
                                value: Number(e.target.value),
                                stockId: stockForLocation?.id
                              }
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  {index !== locsArr.length - 1 && (
                    <hr className="w-full mb-2 border-zinc-100 mt-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <ButtonSpinner loading={isSaving}>Save</ButtonSpinner>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { EditProductStockForm };
