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
import { Button, ButtonSpinner } from "../ui/button";
import { type SubmitHandler, useForm } from "react-hook-form";
import {
	type EditCustomerSchema,
	editCustomerSchema,
} from "@/lib/schemas/customer-schema";
import { zodResolver } from "@hookform/resolvers/zod";

import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import type { locations, userRoles, users } from "../../../drizzle/schema";
import { useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type User = typeof users.$inferSelect & {
	locations?: Pick<typeof locations.$inferSelect, "name" | "id">[] | null;
};

export default function EditUserForm({
	isOpen,
	onOpenChange,
	currentUserRole,
	user,
}: {
	currentUserRole: (typeof userRoles.enumValues)[number];
	user: User;
	isOpen: boolean;
	onOpenChange: (value: boolean) => void;
}) {
	const router = useRouter();

	const form = useForm<EditCustomerSchema>({
		resolver: zodResolver(editCustomerSchema),
		shouldUnregister: true,
		defaultValues: {
			firstName: user.firstName,
			lastName: user.lastName,
			...(user.email && { email: user.email }),
			...(user.phone && { phone: user.phone }),
		},
	});

	const handleSubmit: SubmitHandler<EditCustomerSchema> = async (data) => {
		console.log("submitting...", data);

		const response = await fetch(`/api/customers/${user.id}`, {
			method: "PATCH",
			body: JSON.stringify(data),
		});

		if (response.ok) {
			// router.push('/dashboard');
			router.refresh();
			onOpenChange(false);
			toast.success(`Successfully edited ${user.firstName} ${user.lastName}`);
		} else {
			const error = await response.json();
			console.log("Create user failed:", error);
			toast.error("Failed to create user", { dismissible: true });
		}
	};

	useEffect(() => {
		if (isOpen) {
			form.reset({
				firstName: user.firstName,
				lastName: user.lastName,
				phone: user.phone ?? "",
			});
		}
	}, [user, form, isOpen]);

	useEffect(() => {
		console.log("form.formState.errors", form.formState.errors);
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
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-5 px-4"
						>
							<FormField
								control={form.control}
								name="firstName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>First Name</FormLabel>
										<FormControl>
											<Input
												placeholder="User's first name"
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
								name="lastName"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Last Name</FormLabel>
										<FormControl>
											<Input
												placeholder="User's last name"
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
								name="phone"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Phone</FormLabel>
										<FormControl>
											<PhoneInput
												placeholder="User's phone"
												type="text"
												{...field}
											/>
										</FormControl>
										<FormDescription className="text-xs">
											Customers require phone logins.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
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
