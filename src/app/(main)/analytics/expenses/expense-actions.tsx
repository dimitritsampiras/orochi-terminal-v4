"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteExpense } from "./actions";

export function DeleteExpenseButton({ id }: { id: string }) {
    const [isPending, startTransition] = useTransition();

    return (
        <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            onClick={() => {
                const confirmed = window.confirm("Are you sure you want to delete this expense?");
                if (!confirmed) return;

                startTransition(async () => {
                    try {
                        await deleteExpense(id);
                        toast.success("Expense deleted");
                    } catch (error) {
                        toast.error("Failed to delete expense");
                    }
                });
            }}
        >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
    );
}
