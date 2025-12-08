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

import type { EditContentSchema } from '@/lib/schemas/content-schema';

import { useState } from 'react';

import { useRouter } from 'next/navigation';
import type { EditContentResponse, GetContentResponse } from '@/lib/types/misc';
import { toast } from 'sonner';

type Content = NonNullable<GetContentResponse['data']>['content'][number];

export default function ActivateContentForm({
  isOpen,
  onOpenChange,
  content
}: {
  content: Content;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: EditContentSchema) => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/content/${content.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: !content.active })
      });

      if (response.ok) {
        router.refresh();
        onOpenChange(false);
        toast.success(
          `Successfully ${content.active ? 'deactivated' : 'activated'} ${content.title}`
        );
      } else {
        const { error } = (await response.json()) as EditContentResponse;
        console.log('Activate/deactivate content failed:', error);
        toast.error(`Failed to ${content.active ? 'deactivate' : 'activate'} content`, {
          dismissible: true,
          description: error || 'An unknown error occurred',
          descriptionClassName: 'text-zinc-900!'
        });
      }
    } catch (error) {
      console.error('Activate/deactivate content error:', error);
      toast.error(`Failed to ${content.active ? 'deactivate' : 'activate'} content`, {
        dismissible: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {content.active ? 'Deactivate' : 'Activate'} {content.title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {content.active ? 'deactivate' : 'activate'} "
            {content.title}"? This action will{' '}
            {content.active ? 'prevent it from being displayed' : 'allow it to be displayed'}{' '}
            in the app.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            onClick={() => handleSubmit({ active: !content.active })}
            type="submit"
            disabled={isSubmitting}
            variant={content.active ? 'destructive' : 'default'}
          >
            <ButtonSpinner loading={isSubmitting}>
              {content.active ? 'Deactivate Content' : 'Activate Content'}
            </ButtonSpinner>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
