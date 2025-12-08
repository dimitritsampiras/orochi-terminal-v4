'use client';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Button, ButtonSpinner } from '@/components/ui/button';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { EditContentResponse } from '@/lib/types/misc';
import { editContentSchema, type EditContentSchema } from '@/lib/schemas/content-schema';
import { ImageDropzone } from '../../inputs/image-dropzone';
import { SearchProductsMultiSelect } from '../../inputs/search-products-multi-select';
import { SearchServicesMultiSelect } from '../../inputs/search-services-multi-select';
import { cn } from '@/lib/utils';

type ContentItem = {
  id: number;
  title: string;
  imgUrl: string;
  description: string;
  text: string;
  active: boolean;
  products: {
    id: number;
    name: string;
    price: number;
    imgUrl: string;
  }[];
  services: {
    id: string;
    name: string;
    price: number;
    imgUrl: string;
  }[];
};

export default function EditContentForm({
  content,
  isOpen,
  onOpenChange
}: {
  content: ContentItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const form = useForm<EditContentSchema>({
    resolver: zodResolver(editContentSchema)
  });

  const handleSubmit: SubmitHandler<EditContentSchema> = async (data) => {
    const response = await fetch(`/api/content/${content.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });

    if (response.ok) {
      router.refresh();
      onOpenChange(false);
      toast.success(`Successfully updated ${content.title}`);
      form.reset();
    } else {
      const error = (await response.json()) as EditContentResponse;
      console.log('Edit content failed:', error);
      toast.error('Failed to update content', {
        dismissible: true,
        description: error?.error || 'Failed to update content',
        descriptionClassName: 'text-zinc-800!'
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: content.title,
        imgUrl: content.imgUrl,
        description: content.description,
        text: content.text,
        active: content.active,
        productIds: content.products.map((product) => product.id),
        serviceIds: content.services.map((service) => service.id)
      });
    } else {
      form.reset();
    }
  }, [content, form, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsPreviewOpen(false);
    }
  }, [isOpen, setIsPreviewOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(isPreviewOpen && 'md:min-w-3xl', 'transition-all! duration-300!')}
      >
        <div className="h-full w-full flex flex-col">
          <SheetHeader className="border-b flex flex-row items-center justify-between mt-8">
            <div>
              <SheetTitle>Edit {content.title}</SheetTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPreviewOpen((prev) => !prev)}
            >
              {isPreviewOpen ? 'Close Preview' : 'Preview Content'}
            </Button>
          </SheetHeader>

          <div className="flex flex-row-reverse">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex flex-col h-[calc(100vh-10rem)] flex-1"
              >
                <div className="flex-1 overflow-y-scroll pb-20 px-4 flex flex-col gap-5 pt-4">
                  <FormField
                    control={form.control}
                    name="imgUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image</FormLabel>
                        <FormControl>
                          <ImageDropzone
                            url={field.value || ''}
                            setUrl={(url) => {
                              field.onChange(url || '');
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Content title"
                            className="text-sm"
                            type="text"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            className="text-sm"
                            placeholder="Short description of the content"
                            type="text"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content Text</FormLabel>
                        <FormControl>
                          <Textarea
                            className="text-sm min-h-[120px]"
                            placeholder="Main content text"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <hr className="my-4" />

                  <FormField
                    control={form.control}
                    name="productIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Related Products</FormLabel>
                        <FormDescription>
                          Select products to associate with this content.
                        </FormDescription>
                        <FormControl>
                          <SearchProductsMultiSelect
                            currentUpsellSelection={content.products.map((product) => ({
                              id: product.id,
                              name: product.name,
                              price: product.price,
                              imgUrl: product.imgUrl,
                              shortDescription: ''
                            }))}
                            maxSelections={5}
                            onSelectionChange={(productIds) => {
                              form.setValue('productIds', productIds);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Related Services</FormLabel>
                        <FormDescription>
                          Select services to associate with this content.
                        </FormDescription>
                        <FormControl>
                          <SearchServicesMultiSelect
                            currentUpsellSelection={content.services.map((service) => ({
                              id: service.id,
                              name: service.name,
                              price: service.price,
                              imgUrl: service.imgUrl,
                              shortDescription: ''
                            }))}
                            maxSelections={5}
                            onSelectionChange={(serviceIds) => {
                              form.setValue('serviceIds', serviceIds);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting || !form.formState.isValid}
                  >
                    <ButtonSpinner loading={form.formState.isSubmitting}>
                      Update Content
                    </ButtonSpinner>
                  </Button>
                </SheetFooter>
              </form>
            </Form>
            {isPreviewOpen && <div className="flex-1 bg-zinc-50" />}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
