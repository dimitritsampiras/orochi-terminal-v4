"use client";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const expenseSchema = z.object({
    category: z.enum(["rent", "salary", "marketing_meta", "marketing_google", "sponsorship", "other"]),
    amount: z.coerce.number().positive(),
    dateRange: z.object({
        from: z.date(),
        to: z.date().optional(),
    }),
    notes: z.string().optional(),
    batchId: z.preprocess(
        (val) => (val === "" ? undefined : val),
        z.coerce.number().optional()
    ),
});

export function ExpenseForm() {
    const router = useRouter();
    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            category: "other",
            dateRange: {
                from: new Date(),
                to: new Date(),
            },
            amount: 0,
            notes: "",
            batchId: "",
        },
    });

    async function onSubmit(values: z.infer<typeof expenseSchema>) {
        try {
            const { from, to } = values.dateRange;
            const isRange = to && from.getTime() !== to.getTime();

            const payload = {
                category: values.category,
                amount: values.amount,
                notes: values.notes,
                batchId: values.batchId,
                date: from.toISOString(),
                periodStart: isRange ? from.toISOString() : undefined,
                periodEnd: isRange ? to!.toISOString() : undefined,
            };

            const res = await fetch("/api/analytics/expenses", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error();

            toast.success("Expense added");
            form.reset({
                category: "other",
                dateRange: {
                    from: new Date(),
                    to: new Date(),
                },
                amount: 0,
                notes: "",
                batchId: ""
            });
            router.refresh();
        } catch {
            toast.error("Failed to add expense");
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="rent">Rent</SelectItem>
                                    <SelectItem value="salary">Salary</SelectItem>
                                    <SelectItem value="marketing_meta">Marketing (Meta)</SelectItem>
                                    <SelectItem value="marketing_google">Marketing (Google)</SelectItem>
                                    <SelectItem value="sponsorship">Sponsorship</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount ($)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="dateRange"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Date / Period</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value?.from ? (
                                                field.value.to ? (
                                                    <>
                                                        {format(field.value.from, "LLL dd, y")} -{" "}
                                                        {format(field.value.to, "LLL dd, y")}
                                                    </>
                                                ) : (
                                                    format(field.value.from, "LLL dd, y")
                                                )
                                            ) : (
                                                <span>Pick a date</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="range"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                            date > new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="batchId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Batch ID (Optional)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Leave empty for global expense" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                                <Input {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit">Add Expense</Button>
            </form>
        </Form>
    );
}
