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
import { Button, ButtonSpinner } from '../ui/button';

import type { EditUserSchema } from '@/lib/schemas/user-schema';

import type { userRoles, users } from '../../../drizzle/schema';

import { useState } from 'react';

import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircleIcon } from 'lucide-react';
import type { EditUserResponse } from '@/lib/types/misc';
import { toast } from 'sonner';

export default function DeactivateUserForm({
  isOpen,
  onOpenChange,
  currentUserRole,
  user
}: {
  currentUserRole: (typeof userRoles.enumValues)[number];
  user: typeof users.$inferSelect;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if the current user can deactivate this user
  const canModify = !(user.role === 'super_admin' && currentUserRole === 'admin');

  const handleSubmit = async (data: EditUserSchema) => {
    if (!canModify) {
      toast.error('You do not have permission to deactivate this user');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: !user.active })
      });

      if (response.ok) {
        router.refresh();
        onOpenChange(false);
        toast.success(
          `Successfully ${user.active ? 'deactivated' : 'activated'} ${user.firstName} ${
            user.lastName
          }`
        );
      } else {
        const { error } = (await response.json()) as EditUserResponse;
        console.log('Deactivate user failed:', error);
        toast.error('Failed to deactivate user', {
          dismissible: true,
          description: error || 'An unknown error occurred',
          descriptionClassName: 'text-zinc-900!'
        });
      }
    } catch (error) {
      console.error('Deactivate user error:', error);
      toast.error('Failed to deactivate user', { dismissible: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {user.active ? 'Deactivate' : 'Activate'} {user.firstName} {user.lastName}'s
            Account
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {user.active ? 'deactivate' : 'activate'} {user.firstName}{' '}
            {user.lastName}? This action will{' '}
            {user.active
              ? 'prevent them from accessing the system'
              : 'allow them to access the system'}
            {!canModify && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>
                  You cannot change the activation status of a Super Admin as an Admin user.
                </AlertTitle>
                <AlertDescription>
                  <p>Please contact your administrator to proceed.</p>
                </AlertDescription>
              </Alert>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            onClick={() => handleSubmit({ active: false })}
            type="submit"
            disabled={!canModify || isSubmitting}
            variant={user.active ? 'destructive' : 'default'}
          >
            <ButtonSpinner loading={isSubmitting}>
              {user.active ? 'Deactivate User' : 'Activate User'}
            </ButtonSpinner>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
