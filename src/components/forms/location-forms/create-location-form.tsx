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

import type { cities, countries } from "../../../../drizzle/schema";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import type { CreateLocationResponse } from "@/lib/types/misc";
import {
	type CreateLocationSchema,
	createLocationSchema,
} from "@/lib/schemas/location-schema";
import { MapInput } from "@/components/input-fields/map";
import SingleSelectAutocomplete from "@/components/input-fields/single-select-autocomplete";

type City = typeof cities.$inferSelect;
type Country = typeof countries.$inferSelect;

export default function CreateLocationForm({
	cities,
	countries,
}: {
	cities: City[];
	countries: Country[];
}) {
	const router = useRouter();
	const [isSheetOpen, setIsSheetOpen] = useState(false);
	const [coordinates, setCoordinates] = useState<{
		lat: number;
		lng: number;
	} | null>(null);

	const form = useForm<CreateLocationSchema>({
		resolver: zodResolver(createLocationSchema),
		defaultValues: {
			name: "",
			address: "",
			postalCode: "",
			lat: 0,
			lng: 0,
			city: { type: null, value: null, label: "" },
			country: { type: null, value: null, label: "" },
		},
	});

	const handleSubmit: SubmitHandler<CreateLocationSchema> = async (data) => {
		console.log("submitting...");

		const response = await fetch("/api/locations", {
			method: "POST",
			body: JSON.stringify(data),
		});

		if (response.ok) {
			router.refresh();
			setIsSheetOpen(false);
			toast.success("Successfully created location");
			form.reset();
		} else {
			const error = (await response.json()) as CreateLocationResponse;
			console.log("Create location failed:", error);
			toast.error("Failed to create location", {
				dismissible: true,
				description: error?.error || "Failed to create location",
				descriptionClassName: "text-zinc-800!",
			});
		}
	};

	useEffect(() => {
		console.log("form.watch", form.watch("city"));
	}, [form.watch("city")]);

	return (
		<Sheet open={isSheetOpen} onOpenChange={(value) => setIsSheetOpen(value)}>
			<SheetTrigger className={buttonVariants()}>
				<Icon icon="ph:plus-bold" className="size-4" />
				Add Location
			</SheetTrigger>
			<SheetContent className="max-w-xl!">
				<div className="h-full w-full flex flex-col">
					<SheetHeader className="border-b">
						<SheetTitle>Add a Location</SheetTitle>
						<SheetDescription>
							Create a new location with the following details.
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
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Name</FormLabel>
											<FormDescription>
												The name of the business location.
											</FormDescription>
											<FormControl>
												<Input
													placeholder="Location name"
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
									name="address"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Address</FormLabel>
											<FormControl>
												<Input
													className="text-sm"
													placeholder="Address of the location"
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
									name="postalCode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Postal Code</FormLabel>
											<FormControl>
												<Input
													className="text-sm"
													placeholder="Postal code of the location"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="city"
									render={({ field }) => (
										<FormItem>
											<FormLabel>City</FormLabel>
											<FormDescription>
												Select a city or add a new one
											</FormDescription>
											<FormControl>
												<SingleSelectAutocomplete
													options={cities.map((city) => ({
														label: city.name,
														value: city.id,
													}))}
													value={field.value}
													onChange={field.onChange}
													placeholder="Search cities or add new one"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="country"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Country</FormLabel>
											<FormDescription>
												Select a country or add a new one
											</FormDescription>
											<FormControl>
												<SingleSelectAutocomplete
													options={countries.map((country) => ({
														label: country.name,
														value: country.id,
													}))}
													value={field.value}
													onChange={field.onChange}
													placeholder="Search countries or add new one"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<hr className="my-4 " />
								<div className="space-y-3">
									<FormLabel>Map Pin</FormLabel>
									<FormDescription>
										The map pin will be used to locate the business location and
										auto fill the coordinates.
									</FormDescription>
									<MapInput
										addressValue={{
											address: form.watch("address"),
											postalCode: form.watch("postalCode"),
											city: form.watch("city.label"),
											country: form.watch("country.label"),
										}}
										setCoordinates={({ lat, lng }) => {
											form.setValue("lat", lat);
											form.setValue("lng", lng);
										}}
									/>
								</div>
								<div className="flex items-center justify-between gap-2">
									<FormField
										control={form.control}
										name="lat"
										render={({ field }) => (
											<FormItem className="w-full">
												<FormLabel>Latitude</FormLabel>
												<FormControl>
													<Input
														className="text-sm"
														placeholder="12.345678"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name="lat"
										render={({ field }) => (
											<FormItem className="w-full">
												<FormLabel>Longitude</FormLabel>
												<FormControl>
													<Input
														className="text-sm"
														placeholder="98.765432"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
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
										Edit Location
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
