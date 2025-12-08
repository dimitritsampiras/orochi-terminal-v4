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

import type { EditServiceSchema } from '@/lib/schemas/service-schema';

import { useState } from 'react';

import { useRouter } from 'next/navigation';
import type { EditServiceResponse, GetServicesResponse } from '@/lib/types/misc';
import { toast } from 'sonner';

type Service = NonNullable<GetServicesResponse['data']>['services'][number];

export default function ActivateServiceForm({
  isOpen,
  onOpenChange,
  service
}: {
  service: Service;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: EditServiceSchema) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: !service.active })
      });

      if (response.ok) {
        router.refresh();
        onOpenChange(false);
        toast.success(
          `Successfully ${service.active ? 'deactivated' : 'activated'} ${service.name}`
        );
      } else {
        const { error } = (await response.json()) as EditServiceResponse;
        console.log('Deactivate service failed:', error);
        toast.error('Failed to deactivate service', {
          dismissible: true,
          description: error || 'An unknown error occurred',
          descriptionClassName: 'text-zinc-900!'
        });
      }
    } catch (error) {
      console.error('Deactivate service error:', error);
      toast.error('Failed to deactivate service', { dismissible: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {service.active ? 'Deactivate' : 'Activate'} {service.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {service.active ? 'deactivate' : 'activate'}{' '}
            {service.name}? This action will{' '}
            {service.active ? 'prevent it from being displayed' : 'allow it to be displayed'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            onClick={() => handleSubmit({ active: false })}
            type="submit"
            disabled={isSubmitting}
            variant={service.active ? 'destructive' : 'default'}
          >
            <ButtonSpinner loading={isSubmitting}>
              {service.active ? 'Deactivate Service' : 'Activate Service'}
            </ButtonSpinner>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
