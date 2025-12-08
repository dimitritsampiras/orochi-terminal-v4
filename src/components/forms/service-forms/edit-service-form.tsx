"use client";

import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Button, ButtonSpinner } from "../../ui/button";

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

import { useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { EditServiceResponse, GetServicesResponse } from "@/lib/types/misc";
import {
	editServiceSchema,
	type EditServiceSchema,
} from "@/lib/schemas/service-schema";
import { ImageDropzone } from "../../inputs/image-dropzone";
import { Textarea } from "../../ui/textarea";
import MultiSelectAutocomplete from "@/components/inputs/multi-select-autocomplete";
import { SearchServicesSingleSelect } from "@/components/input-fields/search-services-single-select";

type Category = typeof categories.$inferSelect;
type Service = NonNullable<GetServicesResponse["data"]>["services"][number];

export default function EditServiceForm({
	categories,
	service,
	isOpen,
	onOpenChange,
}: {
	categories: Category[];
	service: Service;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();

	const form = useForm<EditServiceSchema>({
		resolver: zodResolver(editServiceSchema),
	});

	const handleSubmit: SubmitHandler<EditServiceSchema> = async (data) => {
		const response = await fetch(`/api/services/${service.id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		});

		if (response.ok) {
			router.refresh();
			onOpenChange(false);
			toast.success(`Successfully updated ${service.name}`);
		} else {
			const error = (await response.json()) as EditServiceResponse;
			console.log("Edit service failed:", error);
			toast.error("Failed to update service", {
				dismissible: true,
				description: error?.error || "Failed to update service",
				descriptionClassName: "text-zinc-800!",
			});
		}
	};

	useEffect(() => {
		if (isOpen) {
			console.log("service", service);

			form.reset({
				categoryIds: service.categories.map((category) => category.id),
				newCategories: [] as string[],
				imageUrl: service.imgUrl,
				description: service.description || "",
				name: service.name,
				price: service.price,
				shortDescription: service.shortDescription || "",
				upsellId: service.upsellServiceId || "",
			} satisfies EditServiceSchema);
			console.log("form values", form.getValues());

			console.log("form errors", form.formState.errors, form.formState.isValid);
		} else {
			form.reset();
		}
	}, [isOpen]);

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			<SheetContent>
				<div className="h-full w-full flex flex-col">
					<SheetHeader className="border-b">
						<SheetTitle>Edit {service.name}</SheetTitle>
						<SheetDescription>
							Edit the service with the following details.
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
													url={field.value || ""}
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
										name="upsellId"
										render={({ field }) => {
											return (
												<FormItem>
													<FormLabel>Upsells</FormLabel>
													<FormDescription>
														Select the upsell(s) for this service.
													</FormDescription>
													<FormControl>
														<SearchServicesSingleSelect
															currentUpsellSelection={
																service.upsellService ?? undefined
															}
															onSelectionChange={(value) => {
																form.setValue("upsellId", value ?? "");
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
								<Button type="submit" disabled={form.formState.isSubmitting}>
									<ButtonSpinner loading={form.formState.isSubmitting}>
										Update Service
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
