'use client';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { Button, ButtonSpinner, buttonVariants } from '@/components/ui/button';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import type { CreateContentResponse } from '@/lib/types/misc';
import { type CreateContentSchema, createContentSchema } from '@/lib/schemas/content-schema';
import { ImageDropzone } from '../../inputs/image-dropzone';
import { cn } from '@/lib/utils';
import { SearchProductsMultiSelect } from '../../inputs/search-products-multi-select';
import { SearchServicesSingleSelect } from '../../inputs/search-services-single-select';
import { SearchServicesMultiSelect } from '../../inputs/search-services-multi-select';

export default function CreateContentForm() {
  const router = useRouter();

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const form = useForm<CreateContentSchema>({
    resolver: zodResolver(createContentSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      imgUrl: '',
      description: '',
      text: '',
      productIds: [],
      serviceIds: []
    }
  });

  const handleSubmit: SubmitHandler<CreateContentSchema> = async (data) => {
    console.log('submitting...');
    console.log('submitted data:', data);

    const response = await fetch('/api/content', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (response.ok) {
      router.refresh();
      setIsSheetOpen(false);
      form.reset();
      toast.success('Successfully created content');
    } else {
      const error = (await response.json()) as CreateContentResponse;
      console.log('Create content failed:', error);
      toast.error('Failed to create content', {
        dismissible: true,
        description: error?.error || 'Failed to create content',
        descriptionClassName: 'text-zinc-800!'
      });
    }
  };

  useEffect(() => {
    if (!isSheetOpen) {
      setIsPreviewOpen(false);
    }
  }, [isSheetOpen, setIsPreviewOpen]);

  return (
    <Sheet open={isSheetOpen} onOpenChange={(value) => setIsSheetOpen(value)}>
      <SheetTrigger className={buttonVariants()}>
        <Icon icon="ph:plus-bold" className="size-4" />
        Add Content
      </SheetTrigger>
      <SheetContent
        className={cn(isPreviewOpen && 'md:min-w-3xl', 'transition-all! duration-300!')}
      >
        <div className="h-full w-full flex flex-col">
          <SheetHeader className="border-b flex flex-row items-center justify-between mt-8">
            <div>
              <SheetTitle>Add Content</SheetTitle>
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
                  <div>
                    <FormLabel htmlFor="imgUrl" className="mb-2">
                      Image
                    </FormLabel>

                    <ImageDropzone
                      url={form.watch('imgUrl')}
                      setUrl={(url) =>
                        url ? form.setValue('imgUrl', url) : form.setValue('imgUrl', '')
                      }
                    />
                  </div>

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
                            maxSelections={5}
                            onSelectionChange={(products) => {
                              form.setValue(
                                'productIds',
                                products.map((p) => p)
                              );
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
                            maxSelections={5}
                            onSelectionChange={(services) => {
                              form.setValue(
                                'serviceIds',
                                services.map((s) => s)
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.formState.errors.root && (
                    <div className="text-red-500 text-sm">
                      {form.formState.errors.root.message}
                    </div>
                  )}
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
                      Create Content
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
