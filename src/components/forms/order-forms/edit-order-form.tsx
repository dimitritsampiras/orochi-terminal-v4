'use client';

// import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Button, ButtonSpinner } from '@/components/ui/button';
import { Icon } from '@iconify/react';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '../../ui/form';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { EditOrderSchema, GetOrdersResponse } from '@/lib/schemas/orders-schema';
import { editOrderSchema } from '@/lib/schemas/orders-schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { PaymentStatusBadge } from '@/components/badges/queue-status-badge';
import { DeliveryTypeBadge } from '@/components/badges/delivery-type-badge';
import { deliveryTypes, orderStatuses } from '../../../../drizzle/schema';
import { OrderStatusBadge } from '@/components/badges/order-status-badge';
import { DateTimePicker } from '@/components/ui/date-time';
import { Card } from '@/components/ui/card';
import Image from 'next/image';

import { Badge } from '@/components/ui/badge';
import { SearchProductsMultiSelect } from '@/components/input-fields/search-products-multi-select';

type Order = GetOrdersResponse['orders'][number];

export default function EditOrderForm({
  order,
  isOpen,
  onOpenChange
}: {
  order: Order;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const form = useForm<EditOrderSchema>({
    resolver: zodResolver(editOrderSchema)
  });

  const handleSubmit: SubmitHandler<EditOrderSchema> = async (data) => {
    const response = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });

    if (response.ok) {
      router.refresh();
      onOpenChange(false);
      toast.success(`Successfully updated order #${order.orderNumber}`);
      form.reset();
    } else {
      const error = await response.json();
      console.log('Update order failed:', error);
      toast.error('Failed to update order', {
        dismissible: true,
        description: error?.error || 'Failed to update order',
        descriptionClassName: 'text-zinc-800!'
      });
    }
  };

  useEffect(() => {
    if (isOpen && order) {
      form.reset({
        deliveryType: order.deliveryType,
        status: order.status,
        bookingDate: order.bookingDate || undefined,
        addedProducts: [],
        removedProducts: []
      });
    } else {
      form.reset();
    }
  }, [order, form, isOpen]);

  useEffect(() => {
    console.log('addedProducts', form.watch('addedProducts'));
    console.log('removedProducts', form.watch('removedProducts'));
  }, [form.watch('addedProducts'), form.watch('removedProducts')]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="h-full w-full flex flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>Edit Order #{order?.orderNumber}</SheetTitle>
            <SheetDescription>Edit the order details below.</SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="flex flex-col h-[calc(100vh-10rem)]"
            >
              <div className="flex-1 overflow-y-scroll pb-20 px-4 flex flex-col gap-5 pt-4">
                <div className="space-y-2">
                  <FormLabel>Payment Status</FormLabel>
                  <FormDescription className="text-xs!">
                    You cannot modify the payment status of an order.
                  </FormDescription>
                  <PaymentStatusBadge paid={order.paid} />
                </div>
                <div className="space-y-2">
                  <FormLabel>Payment Method</FormLabel>
                  <FormDescription className="text-xs!">
                    You cannot modify the payment method of an order.
                  </FormDescription>
                  <Badge variant="outline">{order.paymentMethod}</Badge>
                </div>

                <FormField
                  control={form.control}
                  name="deliveryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Type</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={
                            form.formState.isSubmitting ||
                            order.status === 'delivered' ||
                            order.status === 'canceled'
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="select a delivery type" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryTypes.enumValues.map((type) => (
                              <SelectItem key={type} value={type}>
                                <DeliveryTypeBadge deliveryType={type} />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Status</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={form.formState.isSubmitting}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="select an order status" />
                          </SelectTrigger>
                          <SelectContent>
                            {orderStatuses.enumValues.map((status) => (
                              <SelectItem key={status} value={status}>
                                <OrderStatusBadge orderStatus={status} />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <hr className="my-3" />

                <div>
                  <h2 className="text-base font-medium mb-2">Products</h2>
                  <div className='space-y-2'>
                    {order.products.filter(Boolean).length > 0 ? (
                      order.products.filter(Boolean).map((product) => {
                        const isRemoved = form.watch('removedProducts')?.includes(product.id);

                        return (
                          <Card
                            className={`p-4 shadow-none transition-all ${
                              isRemoved ? 'bg-red-50 border-red-200 opacity-60' : 'bg-zinc-50'
                            }`}
                            key={product.id}
                          >
                            <div className="flex items-center gap-2">
                              <Image
                                src={product.imgUrl}
                                alt={product.name}
                                width={50}
                                height={50}
                                className={`rounded-md ${isRemoved ? 'grayscale' : ''}`}
                              />
                              <div className="flex flex-col text-left w-full">
                                <div
                                  className={`text-sm font-medium w-full flex items-center gap-2 justify-between ${
                                    isRemoved ? 'line-through text-muted-foreground' : ''
                                  }`}
                                >
                                  {product.name}
                                </div>
                                <span
                                  className={`text-xs ${
                                    isRemoved ? 'text-red-400' : 'text-muted-foreground'
                                  }`}
                                >
                                  ${product.price.toFixed(2)}
                                  {' • '}
                                  {product.qty} quantity
                                  {isRemoved && ' • Marked for removal'}
                                </span>
                              </div>
                              <div>
                                {isRemoved ? (
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const currentRemoved =
                                        form.getValues('removedProducts') || [];
                                      form.setValue(
                                        'removedProducts',
                                        currentRemoved.filter((id) => id !== product.id)
                                      );
                                    }}
                                  >
                                    <Icon
                                      icon="ph:arrow-counter-clockwise"
                                      className="size-4"
                                    />
                                  </Button>
                                ) : (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      form.setValue('removedProducts', [
                                        ...(form.getValues('removedProducts') || []),
                                        product.id
                                      ]);
                                    }}
                                  >
                                    <Icon icon="ph:x" className="size-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    ) : (
                      <div className="text-muted-foreground text-sm">
                        There are no products in this order.
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <SearchProductsMultiSelect
                      placeholder={`Add products to order #${order.orderNumber}`}
                      currentUpsellSelection={order.products
                        .filter(Boolean)
                        .map((product) => ({
                          id: Number(product.id),
                          name: product.name,
                          imgUrl: product.imgUrl,
                          price: product.price,
                          shortDescription: ''
                        }))}
                      hideCurrentSelection={true}
                      onSelectionChange={(products) => {
                        form.setValue(
                          'addedProducts',
                          products.map((product) => product)
                        );
                      }}
                      maxSelections={10}
                      disableIfSelected={true}
                    />
                  </div>
                </div>

                <hr className="my-3" />

                <div>
                  <h2 className="text-base font-medium mb-1">Services</h2>
                  {order.services.filter(Boolean).length > 0 ? (
                    <>
                      <FormDescription className="text-xs! mb-2">
                        You cannot modify the services of an order.
                      </FormDescription>
                      <div className="flex flex-col gap-2 mb-4">
                        {order.services.filter(Boolean).map((service, index) => (
                          <Card
                            className="p-4 shadow-none bg-zinc-50"
                            key={`${service.id}-${index}`}
                          >
                            <div className="flex items-center gap-2">
                              <Image
                                src={service.imgUrl}
                                alt={service.name}
                                width={25}
                                height={25}
                                className="rounded-md"
                              />
                              <div className="flex flex-col text-left w-full">
                                <div className="text-sm font-medium w-full flex items-center gap-2 justify-between">
                                  {service.name}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  ${service.price.toFixed(2)}
                                  {' • '}
                                  {service.qty} quantity
                                </span>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      <FormField
                        control={form.control}
                        name="bookingDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Booking Date</FormLabel>
                            <FormControl>
                              <DateTimePicker
                                value={field.value}
                                onChange={field.onChange}
                                disabled={form.formState.isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      There are no services in this order.
                    </div>
                  )}
                </div>
              </div>
              <SheetFooter className="flex flex-row items-center justify-end gap-2 absolute bottom-0 left-0 right-0 border-t bg-white h-20">
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
                    Update Order
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
