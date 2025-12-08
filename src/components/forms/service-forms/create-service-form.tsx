"use client";

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
import { Button, ButtonSpinner, buttonVariants } from "../../ui/button";
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
} from "../../ui/form";
import { Input } from "../../ui/input";

import type { categories } from "../../../../drizzle/schema";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import type { CreateServiceResponse } from "@/lib/types/misc";

import { ImageDropzone } from "../../inputs/image-dropzone";
import { Textarea } from "../../ui/textarea";
import MultiSelectAutocomplete from "@/components/inputs/multi-select-autocomplete";

import {
	type CreateServiceSchema,
	createServiceSchema,
} from "@/lib/schemas/service-schema";
import { SearchServicesSingleSelect } from "@/components/input-fields/search-services-single-select";

type Category = typeof categories.$inferSelect;

export default function CreateServiceForm({
	categories,
}: {
	categories: Category[];
}) {
	const router = useRouter();
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const form = useForm<CreateServiceSchema>({
		resolver: zodResolver(createServiceSchema),
		defaultValues: {
			categoryIds: [],
			newCategories: [],
			imageUrl: "",
			description: "",
			name: "",
			price: 0,
			shortDescription: "",
			upsellId: "",
		},
	});

	const handleSubmit: SubmitHandler<CreateServiceSchema> = async (data) => {
		console.log("submitting...");
		console.log("submitted data:", data);

		const response = await fetch("/api/services", {
			method: "POST",
			body: JSON.stringify(data),
		});

		if (response.ok) {
			router.refresh();
			setIsSheetOpen(false);
			toast.success("Successfully created service");
			form.reset();
		} else {
			const error = (await response.json()) as CreateServiceResponse;
			console.log("Create service failed:", error);
			toast.error("Failed to create service", {
				dismissible: true,
				description: error?.error || "Failed to create service",
				descriptionClassName: "text-zinc-800!",
			});
		}
	};

	return (
		<Sheet open={isSheetOpen} onOpenChange={(value) => setIsSheetOpen(value)}>
			<SheetTrigger className={buttonVariants()}>
				<Icon icon="ph:plus-bold" className="size-4" />
				Add Service
			</SheetTrigger>
			<SheetContent>
				<div className="h-full w-full flex flex-col">
					<SheetHeader className="border-b">
						<SheetTitle>Add a Service</SheetTitle>
						<SheetDescription>
							Create a new service with the following details.
						</SheetDescription>
					</SheetHeader>

					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="flex flex-col h-[calc(100vh-10rem)]"
						>
							<div className="flex-1 overflow-y-scroll pb-20 px-4 flex flex-col gap-5 pt-4">
								<FormField
									control={form.control}
									name="imageUrl"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Image</FormLabel>
											<FormControl>
												<ImageDropzone
													url={field.value}
													setUrl={(url) => {
														field.onChange(url || "");
													}}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormControl>
												<Input
													placeholder="Service name"
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
													placeholder="Short description of the service"
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
												<Textarea
													className="text-sm"
													placeholder="Full description of the service"
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
														placeholder="Price of the service"
														type="number"
														{...field}
													/>
												</FormControl>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>

								<>
									<hr className="my-4" />
									<FormField
										control={form.control}
										name="categoryIds"
										render={({ field }) => {
											return (
												<FormItem>
													<FormLabel>Categories</FormLabel>
													<FormDescription>
														Select the category(s) for this service.
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
																form.setValue(
																	"newCategories",
																	value.newOptions
																);
															}}
															placeholder="Search categories or add new ones"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											);
										}}
									/>
								</>

								<>
									<hr className="my-4" />
									<FormField
										control={form.control}
										name="categoryIds"
										render={({ field }) => {
											return (
												<FormItem>
													<FormLabel>Upsells</FormLabel>
													<FormDescription>
														Select the upsell(s) for this service.
													</FormDescription>
													<FormControl>
														<SearchServicesSingleSelect
															onSelectionChange={(value) => {
																form.setValue("upsellId", value || "");
															}}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											);
										}}
									/>
								</>
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
										Create Service
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
