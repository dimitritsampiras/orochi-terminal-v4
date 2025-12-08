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

import type { EditLocationSchema } from '@/lib/schemas/location-schema';

import { useState } from 'react';

import { useRouter } from 'next/navigation';
import type { EditLocationResponse, GetLocationsResponse } from '@/lib/types/misc';
import { toast } from 'sonner';

type Location = NonNullable<GetLocationsResponse['data']>[number];

export default function ActivateLocationForm({
  isOpen,
  onOpenChange,
  location
}: {
  location: Location;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: EditLocationSchema) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/locations/${location.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !location.active })
      });

      if (response.ok) {
        router.refresh();
        onOpenChange(false);
        toast.success(
          `Successfully ${location.active ? 'deactivated' : 'activated'} ${location.name}`
        );
      } else {
        const { error } = (await response.json()) as EditLocationResponse;
        console.log('Deactivate location failed:', error);
        toast.error('Failed to deactivate location', {
          dismissible: true,
          description: error || 'An unknown error occurred',
          descriptionClassName: 'text-zinc-900!'
        });
      }
    } catch (error) {
      console.error('Deactivate location error:', error);
      toast.error('Failed to deactivate location', { dismissible: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {location.active ? 'Deactivate' : 'Activate'} {location.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {location.active ? 'deactivate' : 'activate'}{' '}
            {location.name}? This action will{' '}
            {location.active ? 'prevent it from being displayed' : 'allow it to be displayed'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            onClick={() => handleSubmit({ active: false })}
            type="submit"
            disabled={isSubmitting}
            variant={location.active ? 'destructive' : 'default'}
          >
            <ButtonSpinner loading={isSubmitting}>
              {location.active ? 'Deactivate Location' : 'Activate Location'}
            </ButtonSpinner>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
