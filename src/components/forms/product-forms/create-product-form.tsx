"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Button, ButtonSpinner, buttonVariants } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import type { categories } from "../../../../drizzle/schema";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import type { CreateProductResponse } from "@/lib/types/misc";
import {
	type CreateProductSchema,
	createProductSchema,
} from "@/lib/schemas/product-schema";
import { ImageDropzone } from "@/components/inputs/image-dropzone";
import { Textarea } from "@/components/ui/textarea";
import MultiSelectAutocomplete from "@/components/inputs/multi-select-autocomplete";
import { SearchProductsMultiSelect } from "@/components/input-fields/search-products-multi-select";

type Category = typeof categories.$inferSelect;

export default function CreateProductForm({
	categories,
}: {
	categories: Category[];
}) {
	const router = useRouter();
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const form = useForm<CreateProductSchema>({
		resolver: zodResolver(createProductSchema),
		defaultValues: {
			categoryIds: [],
			imageUrl: "",
			longDescription: "",
			name: "",
			price: 0,
			shortDescription: "",
			newCategories: [],
			upsellIds: [],
		},
	});

	const handleSubmit: SubmitHandler<CreateProductSchema> = async (data) => {
		console.log("submitting...");
		console.log("submitted data:", data);

		const response = await fetch("/api/products", {
			method: "POST",
			body: JSON.stringify(data),
		});

		if (response.ok) {
			router.refresh();
			setIsSheetOpen(false);
			form.reset();
			toast.success("Successfully created product");
		} else {
			const error = (await response.json()) as CreateProductResponse;
			console.log("Create product failed:", error);
			toast.error("Failed to create product", {
				dismissible: true,
				description: error?.error || "Failed to create product",
				descriptionClassName: "text-zinc-800!",
			});
		}
	};

	return (
		<Sheet open={isSheetOpen} onOpenChange={(value) => setIsSheetOpen(value)}>
			<SheetTrigger className={buttonVariants()}>
				<Icon icon="ph:plus-bold" className="size-4" />
				Add Product
			</SheetTrigger>
			<SheetContent>
				<div className="h-full w-full flex flex-col">
					<SheetHeader className="border-b">
						<SheetTitle>Add a Product</SheetTitle>
						<SheetDescription>
							Create a new product with the following details.
						</SheetDescription>
					</SheetHeader>

					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="flex flex-col h-[calc(100vh-10rem)]"
						>
							<div className="flex-1 overflow-y-scroll pb-20 px-4 flex flex-col gap-5 pt-4">
								<div>
									<FormLabel htmlFor="imageUrl" className="mb-2">
										Image
									</FormLabel>

									<ImageDropzone
										url={form.watch("imageUrl")}
										setUrl={(url) =>
											url
												? form.setValue("imageUrl", url)
												: form.setValue("imageUrl", "")
										}
									/>
								</div>

								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Product name"
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
									name="shortDescription"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Short Description</FormLabel>
											<FormControl>
												<Input
													className="text-sm"
													placeholder="Short description of the product"
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
									name="longDescription"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Description</FormLabel>
											<FormControl>
												<Textarea
													className="text-sm"
													placeholder="Full description of the product"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="price"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Price</FormLabel>
											<div className="flex items-center gap-2">
												<div className="text-sm w-[200px] max-w-[200px] h-full bg-zinc-50 rounded-md px-2 py-1 flex items-center justify-start truncate text-zinc-700">
													{field.value
														? `Rp${Number(field.value).toFixed(2)}`
														: "Rp0.00"}
												</div>

												<FormControl>
													<Input
														placeholder="Price of the product"
														type="number"
														{...field}
													/>
												</FormControl>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>

								<hr className="my-4" />
								<FormField
									control={form.control}
									name="categoryIds"
									render={({ field }) => {
										return (
											<FormItem>
												<FormLabel>Categories</FormLabel>

												<FormDescription>
													Select the category(s) for this product.
												</FormDescription>
												<FormControl>
													<MultiSelectAutocomplete
														options={categories.map((category) => ({
															label: category.name,
															value: category.id,
														}))}
														value={{
															existingIds: form.watch("categoryIds") || [],
															newOptions: form.watch("newCategories") || [],
														}}
														onChange={(value) => {
															form.setValue(
																"categoryIds",
																value.existingIds as number[]
															);
															form.setValue("newCategories", value.newOptions);
														}}
														placeholder="Search categories or add new ones"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										);
									}}
								/>

								<hr className="my-4" />
								<FormField
									control={form.control}
									name="categoryIds"
									render={({ field }) => {
										return (
											<FormItem>
												<FormLabel>Cross-Sells</FormLabel>
												<FormDescription>
													Select the cross-sell(s) for this product.
												</FormDescription>
												<FormControl>
													<SearchProductsMultiSelect
														maxSelections={3}
														onSelectionChange={(value) => {
															form.setValue("upsellIds", value);
														}}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										);
									}}
								/>

								<Alert>
									<Icon icon="ph:package" className="size-4" />
									<AlertTitle className="text-xs">Stock Management</AlertTitle>
									<AlertDescription className="text-xs">
										Stock levels are managed per location. Use the "Manage
										Stock" option after creating the product.
									</AlertDescription>
								</Alert>

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
									disabled={
										form.formState.isSubmitting || !form.formState.isValid
									}
								>
									<ButtonSpinner loading={form.formState.isSubmitting}>
										Create Product
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
