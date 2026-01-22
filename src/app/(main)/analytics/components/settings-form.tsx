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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const settingsSchema = z.object({
    inkCostPerPrint: z.coerce.number().min(0),
    bagCostPerOrder: z.coerce.number().min(0),
    labelCostPerOrder: z.coerce.number().min(0),
    misprintCostMultiplier: z.coerce.number().min(0),
    supplementaryItemCost: z.coerce.number().min(0),
    inkCostPerDesign: z.coerce.number().min(0),
});

type SettingsFormProps = {
    defaultValues: z.infer<typeof settingsSchema>;
};

export function SettingsForm({ defaultValues }: SettingsFormProps) {
    const router = useRouter();
    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(settingsSchema),
        defaultValues,
    });

    async function onSubmit(values: z.infer<typeof settingsSchema>) {
        try {
            const res = await fetch("/api/analytics/settings", {
                method: "POST",
                body: JSON.stringify(values),
            });

            if (!res.ok) throw new Error();

            toast.success("Settings updated");
            router.refresh();
        } catch {
            toast.error("Failed to update settings");
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
                <FormField
                    control={form.control}
                    name="inkCostPerPrint"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Ink Cost Per Print ($)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="bagCostPerOrder"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bag Cost Per Order ($)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="labelCostPerOrder"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Label Cost Per Order ($)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="misprintCostMultiplier"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Misprint Cost Multiplier</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.1" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit">Save Settings</Button>
            </form>
        </Form>
    );
}
