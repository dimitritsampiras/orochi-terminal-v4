import { Icon } from "@iconify/react";
import { Button } from "./ui/button";
import type { Pagination } from "@/lib/types/misc";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

function PaginationController({
	totalPages,
	total,
	className,
}: Pagination & { className?: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentPage = Number.parseInt(searchParams.get("page") ?? "1") || 1;

	const handleNavigate = (newPage: number) => {
		if (newPage >= 1 && newPage <= totalPages) {
			router.replace(`${pathname}?page=${newPage}`, {
				scroll: false,
			});
		}
	};

	return (
		<div className={cn("flex justify-between items-center w-full", className)}>
			<div className="text-xs text-muted-foreground pl-2">
				Page {currentPage} of {totalPages}.
			</div>
			<div className="flex items-center gap-2">
				<Button
					disabled={currentPage === 1}
					variant="outline"
					size="icon"
					className="size-8"
					onClick={() => handleNavigate(1)}
				>
					<Icon icon="ph:caret-double-left-bold" />
				</Button>
				<Button
					disabled={currentPage === 1}
					variant="outline"
					size="icon"
					className="size-8"
					onClick={() => handleNavigate(currentPage - 1)}
				>
					<Icon icon="ph:caret-left-bold" />
				</Button>
				<Button
					disabled={currentPage === totalPages}
					variant="outline"
					size="icon"
					className="size-8"
					onClick={() => handleNavigate(currentPage + 1)}
				>
					<Icon icon="ph:caret-right-bold" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					className="size-8"
					disabled={currentPage === totalPages}
					onClick={() => handleNavigate(totalPages)}
				>
					<Icon icon="ph:caret-double-right-bold" />
				</Button>
			</div>
		</div>
	);
}

export { PaginationController };
