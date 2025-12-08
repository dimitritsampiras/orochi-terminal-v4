'use client';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Button, ButtonSpinner, buttonVariants } from '../ui/button';
import { Icon } from '@iconify/react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { type EditUserSchema, editUserSchema } from '@/lib/schemas/user-schema';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '../ui/form';
import { Input } from '../ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { RoleBadge } from '@/components/badges/role-badge';
import type { cities, countries, locations, userRoles, users } from '../../../drizzle/schema';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn, truncate } from '@/lib/utils';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Location = typeof locations.$inferSelect;

type User = typeof users.$inferSelect & {
  locations?: Pick<typeof locations.$inferSelect, 'name' | 'id'>[] | null;
};

export default function EditUserForm({
  isOpen,
  onOpenChange,
  locs,
  currentUserRole,
  user
}: {
  locs: Location[];
  currentUserRole: (typeof userRoles.enumValues)[number];
  user: User;
  isOpen: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const router = useRouter();

  const ROLES: { value: (typeof userRoles.enumValues)[number]; label: string }[] = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'nurse', label: 'Nurse' }
  ];

  const form = useForm<EditUserSchema>({
    resolver: zodResolver(editUserSchema),
    shouldUnregister: true,
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      ...(user.email && { email: user.email }),
      ...(user.phone && { phone: user.phone }),
      role: user.role,
      ...(user.locations &&
        user.locations.length > 0 && {
          location_ids: user.locations.map((location) => location.id.toString())
        })
    }
  });

  const selectedRole = form.watch('role');

  const handleSubmit: SubmitHandler<EditUserSchema> = async (data) => {
    console.log('submitting...', user.id);

    const response = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });

    if (response.ok) {
      // router.push('/dashboard');
      router.refresh();
      onOpenChange(false);
      toast.success(`Successfully edited ${user.firstName} ${user.lastName}`);
    } else {
      const error = await response.json();
      console.log('Create user failed:', error);
      toast.error('Failed to create user', { dismissible: true });
    }
  };

  useEffect(() => {
    if (isOpen) {
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        ...(user.email && { email: user.email }),
        ...(user.phone && { phone: user.phone }),
        ...(user.locations &&
          user.locations.length > 0 && {
            location_ids: user.locations.map((location) => location.id.toString())
          })
      });
    }
  }, [user, form, isOpen]);

  useEffect(() => {
    console.log('form.formState.errors', form.formState.errors);
  }, [form.formState.errors]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="h-full w-full relative">
          <SheetHeader className="mb-4">
            <SheetTitle>
              Edit {user.firstName} {user.lastName}
            </SheetTitle>
            <SheetDescription>
              Edit the user account with the following details.
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 px-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="User's first name" type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="User's last name" type="text" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="admin" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.filter((role) => {
                            // Admin users can only switch between admin and super_admin roles
                            if (['super_admin', 'admin'].includes(user.role)) {
                              return ['super_admin', 'admin'].includes(role.value);
                            }
                            // Delivery and nurse users can only switch between delivery and nurse roles
                            if (['delivery', 'nurse'].includes(user.role)) {
                              return ['delivery', 'nurse'].includes(role.value);
                            }
                            // Fallback (shouldn't happen in normal flow)
                            return true;
                          }).map((role) => (
                            <SelectItem
                              key={role.value}
                              value={role.value}
                              disabled={
                                role.value === 'super_admin' &&
                                currentUserRole !== 'super_admin'
                              }
                            >
                              <RoleBadge role={role.value} label={role.label} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Show email field for super_admin and admin roles */}
              {(selectedRole === 'super_admin' || selectedRole === 'admin') && (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="User's email" type="email" {...field} />
                      </FormControl>
                      <FormDescription>
                        Super admins and admins require login with email.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Show phone field for delivery and nurse roles */}
              {(selectedRole === 'delivery' || selectedRole === 'nurse') && (
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="User's phone" type="text" {...field} />
                      </FormControl>
                      <FormDescription>
                        Delivery and nurse roles require phone logins.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {['nurse', 'delivery'].includes(selectedRole || '') && (
                <>
                  <hr className="my-8" />
                  <FormField
                    control={form.control}
                    name="location_ids"
                    render={({ field }) => {
                      const [open, setOpen] = React.useState(false);
                      const selectedLocations = locs.filter((location) =>
                        field.value?.includes(location.id.toString())
                      );

                      return (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Location</FormLabel>
                            <Link
                              href="/locations?add=true"
                              className={cn(
                                buttonVariants({ variant: 'link' }),
                                'text-xs gap-1'
                              )}
                            >
                              <Icon icon="ph:plus" className="size-3" />
                              Add new location
                            </Link>
                          </div>
                          <FormDescription>
                            Select the location(s) where the user will be working.
                          </FormDescription>
                          <FormControl>
                            <Popover open={open} onOpenChange={setOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={open}
                                  className="w-full justify-between"
                                >
                                  <span className="truncate">
                                    {selectedLocations.length > 0
                                      ? selectedLocations
                                          .map((location) => location.name)
                                          .join(', ')
                                      : 'Select location(s)...'}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput placeholder="Search locations..." />
                                  <CommandList>
                                    <CommandEmpty>No location found.</CommandEmpty>
                                    <CommandGroup>
                                      {locs.map((location) => (
                                        <CommandItem
                                          key={location.id}
                                          value={location.name}
                                          onSelect={() => {
                                            const currentValue = field.value || [];
                                            const isSelected = currentValue.includes(
                                              location.id.toString()
                                            );
                                            if (isSelected) {
                                              field.onChange(
                                                currentValue.filter(
                                                  (id) => id !== location.id.toString()
                                                )
                                              );
                                            } else {
                                              field.onChange([
                                                ...currentValue,
                                                location.id.toString()
                                              ]);
                                            }
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              'mr-2 h-4 w-4',
                                              field.value?.includes(location.id.toString())
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                            )}
                                          />
                                          <span className="capitalize">
                                            {location.name}, {truncate(location.address, 20)}
                                          </span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </FormControl>
                          <div className="flex gap-1 flex-wrap pt-2">
                            {selectedLocations.map((location) => (
                              <div
                                key={location.id}
                                className="text-sm px-2 py-1 border border-zinc-100 flex w-full rounded-md justify-between bg-zinc-50 items-center gap-2"
                              >
                                <span className="capitalize">
                                  {location.name}, {truncate(location.address, 20)}
                                </span>
                                <Button
                                  type="button"
                                  onClick={() =>
                                    field.onChange(
                                      field.value?.filter(
                                        (id) => id !== location.id.toString()
                                      )
                                    )
                                  }
                                  variant="ghost"
                                  size="icon-sm"
                                >
                                  <Icon icon="ph:x" className="size-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </>
              )}

              <SheetFooter className="flex flex-row justify-end gap-2 absolute bottom-0 left-0 right-0 border-t">
                <SheetClose asChild>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={form.formState.isSubmitting}
                  >
                    Close
                  </Button>
                </SheetClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  <ButtonSpinner loading={form.formState.isSubmitting}>
                    Save Changes
                  </ButtonSpinner>
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
