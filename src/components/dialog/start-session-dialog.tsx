"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

interface StartSessionDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	sessionId: number;
	onSuccess?: () => void;
}

export function StartSessionDialog({
	open,
	onOpenChange,
	sessionId,
	onSuccess,
}: StartSessionDialogProps) {
	const { data, isLoading, error } = useQuery({
		queryKey: ["start-session-preview", sessionId],
		queryFn: async () => {
			const res = await fetch(`/api/batches/${sessionId}/start`);
			const json = await res.json();
			if (!res.ok || json.error) {
				throw new Error(json.error ?? "Failed to load preview");
			}
			return json.data;
		},
		enabled: open,
	});

	const startMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/batches/${sessionId}/start`, {
				method: "POST",
			});
			const json = await res.json();
			if (!res.ok || json.error) {
				throw new Error(json.error ?? "Failed to start session");
			}
			return json.data;
		},
		onSuccess: () => {
			toast.success("Session started");
			onOpenChange(false);
			onSuccess?.();
		},
		onError: (error: Error) => {
			toast.error(error.message);
		},
	});

	const printCount = data?.pickingRequirements?.filter(
		(r: { expectedFulfillmentType: string }) => r.expectedFulfillmentType === "print",
	).length ?? 0;
	const stockCount = data?.pickingRequirements?.filter(
		(r: { expectedFulfillmentType: string }) => r.expectedFulfillmentType === "stock",
	).length ?? 0;
	const blackLabelCount = data?.pickingRequirements?.filter(
		(r: { expectedFulfillmentType: string }) => r.expectedFulfillmentType === "black_label",
	).length ?? 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Start Session</DialogTitle>
					<DialogDescription>
						Review before starting. This locks the assembly line.
					</DialogDescription>
				</DialogHeader>

				{isLoading && <p className="text-center py-4 text-muted-foreground">Loading...</p>}

				{error && (
					<Alert variant="destructive">
						<AlertTitle>Error</AlertTitle>
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				)}

				{data && (
					<div className="space-y-4">
						{/* Summary badges */}
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline">{data.assemblyLine?.length ?? 0} items</Badge>
							<Badge className="bg-blue-100 text-blue-800">{printCount} print</Badge>
							<Badge className="bg-green-100 text-green-800">{stockCount} stock</Badge>
							<Badge className="bg-purple-100 text-purple-800">{blackLabelCount} black label</Badge>
							{data.filteredItems?.length > 0 && (
								<Badge variant="outline" className="bg-zinc-100">
									{data.filteredItems.length} excluded
								</Badge>
							)}
						</div>

						{/* Filtered items */}
						{data.filteredItems?.length > 0 && (
							<div>
								<h4 className="text-sm font-medium mb-1">Excluded Items</h4>
								<div className="bg-zinc-50 border rounded p-2 text-xs max-h-24 overflow-y-auto space-y-1">
									{data.filteredItems.map((item: { name: string; reason: string }, i: number) => (
										<div key={i} className="flex justify-between text-muted-foreground">
											<span className="truncate">{item.name}</span>
											<span>{item.reason}</span>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Assembly line preview */}
						<div>
							<h4 className="text-sm font-medium mb-1">Assembly Line</h4>
							<div className="border rounded max-h-48 overflow-y-auto text-xs">
								<table className="w-full">
									<thead className="bg-zinc-50 sticky top-0">
										<tr>
											<th className="text-left p-2">#</th>
											<th className="text-left p-2">Item</th>
											<th className="text-left p-2">Order</th>
											<th className="text-left p-2">Type</th>
										</tr>
									</thead>
									<tbody>
										{data.assemblyLine?.slice(0, 30).map((item: {
											id: string;
											name: string;
											orderName: string;
											fulfillmentType: string;
											position: number;
										}) => (
											<tr key={item.id} className="border-t">
												<td className="p-2 text-muted-foreground">{item.position + 1}</td>
												<td className="p-2 truncate max-w-[180px]">{item.name}</td>
												<td className="p-2 text-muted-foreground">{item.orderName}</td>
												<td className="p-2">{item.fulfillmentType}</td>
											</tr>
										))}
									</tbody>
								</table>
								{(data.assemblyLine?.length ?? 0) > 30 && (
									<div className="p-2 text-center text-muted-foreground bg-zinc-50">
										+{data.assemblyLine.length - 30} more
									</div>
								)}
							</div>
						</div>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={() => startMutation.mutate()}
						disabled={!data || startMutation.isPending}
						loading={startMutation.isPending}
					>
						Start Session
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
