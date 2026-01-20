"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
	SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { parseGid, sleep } from "@/lib/utils";
import Link from "next/link";
import { Icon } from "@iconify/react";
import type { GetSessionLineItemsResponse } from "@/lib/types/api";

import { useRouter } from "next/navigation";
import type { batches } from "@drizzle/schema";

interface VerifyItemSyncDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	session: typeof batches.$inferSelect;
}

export function VerifyItemSyncDialog({
	open,
	onOpenChange,
	session,
}: VerifyItemSyncDialogProps) {
	const router = useRouter();

	const { data, isLoading, error } = useQuery({
		queryKey: ["session-line-items", session.id],
		queryFn: async () => {
			const res = await fetch(`/api/batches/${session.id}/line-items`);
			const json = (await res.json()) as GetSessionLineItemsResponse;
			if (!res.ok || json.error) {
				throw new Error(json.error ?? "Failed to fetch line items");
			}
			return json.data;
		},
		enabled: open,
	});

	const lineItems = data?.lineItems ?? [];

	// Find items with issues
	const { unsyncedPrints, unsyncedBlanks } = useMemo(() => {
		const unsyncedPrints = lineItems.filter(
			(item) =>
				item.prints.length === 0 &&
				!item.product?.isBlackLabel &&
				item.product?.id,
		);
		const unsyncedBlanks = lineItems.filter(
			(item) =>
				!item.blankVariant && !item.product?.isBlackLabel && item.product?.id,
		);
		return { unsyncedPrints, unsyncedBlanks };
	}, [lineItems]);

	const hasIssues = unsyncedPrints.length > 0 || unsyncedBlanks.length > 0;

	const verifyMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/batches/${session.id}/verify-item-sync`, {
				method: "POST",
			});
			const data = await res.json();
			if (!res.ok || data.error) {
				throw new Error(data.error ?? "Failed to verify");
			}

			router.refresh();
			await sleep(1000);
			return data;
		},
		onSuccess: () => {
			onOpenChange(false);
		},
	});

	const handleVerifyItemSync = () => {
		toast.promise(verifyMutation.mutateAsync(), {
			loading: "Verifying item sync...",
			success: "Item sync verified",
			error: (error) => error.message,
		});
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-2xl overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Verify Item Sync</SheetTitle>
					<SheetDescription>
						Ensure all products have prints and blanks configured before
						verifying inventory.
					</SheetDescription>
				</SheetHeader>
				<div className="px-4">
					{/* Loading state */}
					{isLoading && (
						<p className="text-center py-8 text-muted-foreground">
							Loading line items...
						</p>
					)}

					{/* Error state */}
					{error && (
						<Alert variant="destructive">
							<AlertTitle>Error</AlertTitle>
							<AlertDescription>{error.message}</AlertDescription>
						</Alert>
					)}

					{!isLoading && !error && (
						<>
							{/* Already verified */}
							{session.itemSyncVerifiedAt && (
								<Alert className="bg-green-50 border-green-200 mb-4">
									<Icon
										icon="ph:check-circle"
										className="h-4 w-4 text-green-600"
									/>
									<AlertTitle className="text-green-800">Verified</AlertTitle>
									<AlertDescription className="text-green-700">
										Item sync was verified on{" "}
										{session.itemSyncVerifiedAt
											? new Date(session.itemSyncVerifiedAt).toLocaleString()
											: "unknown"}
										.
									</AlertDescription>
								</Alert>
							)}

							{/* No issues */}
							{!hasIssues && (
								<Alert className="bg-zinc-50 border-zinc-200">
									<Icon icon="ph:check" className="h-4 w-4 text-emerald-600" />
									<AlertTitle className="text-emerald-800">
										All items synced
									</AlertTitle>
									<AlertDescription className="text-zinc-700">
										All {lineItems.length} items have prints and blanks
										configured.
									</AlertDescription>
								</Alert>
							)}

							{/* Unsynced Prints */}
							{unsyncedPrints.length > 0 && (
								<div>
									<div className="flex items-center gap-2 mb-2">
										<h3 className="font-semibold text-orange-700">
											Missing Prints
										</h3>
										<Badge
											variant="outline"
											className="bg-orange-50 text-orange-700"
										>
											{unsyncedPrints.length}
										</Badge>
									</div>
									<div className="border rounded-md bg-white">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Item Name</TableHead>
													<TableHead className="text-right">Action</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{unsyncedPrints.slice(0, 10).map((item) => (
													<TableRow key={item.id}>
														<TableCell className="max-w-[300px] truncate">
															{item.name}
														</TableCell>
														<TableCell className="text-right">
															<Link
																href={`/products/${parseGid(item.product?.id ?? "")}`}
																className="text-sm text-blue-600 hover:underline"
															>
																Configure →
															</Link>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
										{unsyncedPrints.length > 10 && (
											<p className="text-sm text-muted-foreground p-2 text-center">
												...and {unsyncedPrints.length - 10} more
											</p>
										)}
									</div>
								</div>
							)}

							{/* Unsynced Blanks */}
							{unsyncedBlanks.length > 0 && (
								<div>
									<div className="flex items-center gap-2 mb-2">
										<h3 className="font-semibold text-red-700">
											Missing Blanks
										</h3>
										<Badge variant="outline" className="bg-red-50 text-red-700">
											{unsyncedBlanks.length}
										</Badge>
									</div>
									<div className="border rounded-md bg-white">
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Item Name</TableHead>
													<TableHead className="text-right">Action</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{unsyncedBlanks.slice(0, 10).map((item) => (
													<TableRow key={item.id}>
														<TableCell className="max-w-[300px] truncate">
															{item.name}
														</TableCell>
														<TableCell className="text-right">
															<Link
																href={`/products/${parseGid(item.product?.id ?? "")}`}
																className="text-sm text-blue-600 hover:underline"
															>
																Configure →
															</Link>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
										{unsyncedBlanks.length > 10 && (
											<p className="text-sm text-muted-foreground p-2 text-center">
												...and {unsyncedBlanks.length - 10} more
											</p>
										)}
									</div>
								</div>
							)}
						</>
					)}
				</div>

				<SheetFooter>
					<Button
						onClick={handleVerifyItemSync}
						disabled={
							hasIssues ||
							verifyMutation.isPending ||
							Boolean(session.itemSyncVerifiedAt) ||
							isLoading
						}
						loading={verifyMutation.isPending}
					>
						Mark as Verified
					</Button>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
