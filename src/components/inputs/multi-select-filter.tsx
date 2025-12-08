"use client";
import { PlusCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

interface MultiSelectFilterProps {
	title?: string;
	options: {
		label: string;
		value: string;
		icon?: React.ComponentType<{ className?: string }>;
	}[];
	queryParam: string;
}

export function MultiSelectFilter({
	title,
	options,
	queryParam,
}: MultiSelectFilterProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const selectedValues = new Set(searchParams.getAll(queryParam));

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline" className="border-dashed">
					<PlusCircle className="h-4 w-4" />
					{title}
					{selectedValues?.size > 0 && (
						<>
							<Separator orientation="vertical" className="mx-2 h-4" />
							<Badge
								variant="secondary"
								className="rounded-sm px-1 font-normal lg:hidden"
							>
								{selectedValues.size}
							</Badge>
							<div className="hidden space-x-1 lg:flex">
								{selectedValues.size > 2 ? (
									<Badge
										variant="secondary"
										className="rounded-sm px-1 font-normal"
									>
										{selectedValues.size} selected
									</Badge>
								) : (
									options
										.filter((option) => selectedValues.has(option.value))
										.map((option) => (
											<Badge
												variant="secondary"
												key={option.value}
												className="rounded-sm px-1 font-normal"
											>
												{option.label}
											</Badge>
										))
								)}
							</div>
						</>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[200px] p-0" align="start">
				<Command>
					<CommandList>
						<CommandGroup>
							{options.map((option) => {
								const isSelected = selectedValues.has(option.value);
								return (
									<CommandItem
										disabled={false}
										key={option.value}
										onSelect={() => {
											const newSelectedValues = new Set(selectedValues);
											if (isSelected) {
												newSelectedValues.delete(option.value);
											} else {
												newSelectedValues.add(option.value);
											}
											const params = new URLSearchParams(searchParams);
											params.delete(queryParam);
											params.delete("page"); // remove page from params because table might be empty on non 1st page
											newSelectedValues.forEach((value) => {
												params.append(queryParam, value);
											});

											router.replace(`${pathname}?${params.toString()}`, {
												scroll: false,
											});
										}}
									>
										<Checkbox checked={isSelected} />
										<span>{option.label}</span>
									</CommandItem>
								);
							})}
						</CommandGroup>
						{selectedValues.size > 0 && (
							<>
								<CommandSeparator />
								<CommandGroup>
									<CommandItem
										disabled={false}
										onSelect={() => {
											const params = new URLSearchParams(searchParams);
											params.delete(queryParam);
											router.replace(`${pathname}?${params.toString()}`, {
												scroll: false,
											});
										}}
										className="justify-center text-center"
									>
										Clear filters
									</CommandItem>
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
