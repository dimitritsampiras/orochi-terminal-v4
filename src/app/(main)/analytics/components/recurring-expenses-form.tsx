"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { toast } from "sonner";
import { addRecurringExpense, deleteRecurringExpense, RecurringExpense } from "./actions";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { formatInEastern, nowInEastern } from "@/lib/utils";

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    frequency: z.enum(["weekly", "monthly", "yearly"]),
    category: z.enum(["rent", "salary", "marketing_meta", "marketing_google", "sponsorship", "other"]),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date",
    }),
});

type FormValues = z.infer<typeof formSchema>;

export function RecurringExpensesForm({ existingExpenses }: { existingExpenses: RecurringExpense[] }) {
    const [expenses, setExpenses] = useState<RecurringExpense[]>(existingExpenses);
    const [isPending, startTransition] = useTransition();

    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            amount: 0,
            frequency: "monthly",
            category: "other",
            startDate: formatInEastern(nowInEastern(), "yyyy-MM-dd"),
        },
    });

    function onSubmit(values: FormValues) {
        startTransition(async () => {
            try {
                const newExpense = await addRecurringExpense({
                    name: values.name,
                    amount: values.amount,
                    frequency: values.frequency,
                    category: values.category,
                    startDate: new Date(values.startDate),
                });

                setExpenses([...expenses, newExpense]);
                form.reset({
                    name: "",
                    amount: 0,
                    frequency: "monthly",
                    category: "other",
                    startDate: formatInEastern(nowInEastern(), "yyyy-MM-dd"),
                });
                toast.success("Recurring expense added");
            } catch (error) {
                toast.error("Failed to add expense");
                console.error(error);
            }
        });
    }

    function handleDelete(id: string) {
        startTransition(async () => {
            try {
                await deleteRecurringExpense(id);
                setExpenses(expenses.filter((e) => e.id !== id));
                toast.success("Expense deleted");
            } catch (error) {
                toast.error("Failed to delete expense");
            }
        });
    }

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expense Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Warehouse Rent" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="frequency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frequency</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select frequency" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="weekly">Weekly (Salaries)</SelectItem>
                                            <SelectItem value="monthly">Monthly (Rent)</SelectItem>
                                            <SelectItem value="yearly">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Start Date</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Adding..." : "Add Expense"}
                    </Button>
                </form>
            </Form>

            <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-4">Active Recurring Expenses</h3>
                {expenses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active recurring expenses.</p>
                ) : (
                    <div className="space-y-2">
                        {expenses.map((expense) => (
                            <div key={expense.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                                <div>
                                    <p className="font-medium">{expense.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        ${expense.amount.toFixed(2)} / {expense.frequency} • Starts {new Date(expense.startDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(expense.id)}
                                    disabled={isPending}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
