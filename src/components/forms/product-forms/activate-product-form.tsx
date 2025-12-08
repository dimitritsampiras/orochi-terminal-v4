'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button, ButtonSpinner } from '@/components/ui/button';

import type { EditProductSchema } from '@/lib/schemas/product-schema';

import { useState } from 'react';

import { useRouter } from 'next/navigation';
import type {
  EditProductResponse,
  GetProductsResponse
} from '@/lib/types/misc';
import { toast } from 'sonner';

type Product = NonNullable<GetProductsResponse['data']>['products'][number];

export default function ActivateProductForm({
  isOpen,
  onOpenChange,
  product
}: {
  product: Product;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: EditProductSchema) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: !product.active })
      });

      if (response.ok) {
        router.refresh();
        onOpenChange(false);
        toast.success(
          `Successfully ${product.active ? 'deactivated' : 'activated'} ${product.name}`
        );
      } else {
        const { error } = (await response.json()) as EditProductResponse;
        console.log('Deactivate product failed:', error);
        toast.error('Failed to deactivate product', {
          dismissible: true,
          description: error || 'An unknown error occurred',
          descriptionClassName: 'text-zinc-900!'
        });
      }
    } catch (error) {
      console.error('Deactivate product error:', error);
      toast.error('Failed to deactivate product', { dismissible: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {product.active ? 'Deactivate' : 'Activate'} {product.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {product.active ? 'deactivate' : 'activate'}{' '}
            {product.name}? This action will{' '}
            {product.active ? 'prevent it from being displayed' : 'allow it to be displayed'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            onClick={() => handleSubmit({ active: false })}
            type="submit"
            disabled={isSubmitting}
            variant={product.active ? 'destructive' : 'default'}
          >
            <ButtonSpinner loading={isSubmitting}>
              {product.active ? 'Deactivate Product' : 'Activate Product'}
            </ButtonSpinner>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
