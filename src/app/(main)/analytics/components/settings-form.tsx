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
    // Per-item production costs
    inkCostPerItem: z.coerce.number().min(0),
    printerRepairCostPerItem: z.coerce.number().min(0),
    pretreatCostPerItem: z.coerce.number().min(0),
    electricityCostPerItem: z.coerce.number().min(0),
    neckLabelCostPerItem: z.coerce.number().min(0),
    parchmentPaperCostPerItem: z.coerce.number().min(0),

    // Per-order fulfillment costs
    thankYouCardCostPerOrder: z.coerce.number().min(0),
    polymailerCostPerOrder: z.coerce.number().min(0),
    cleaningSolutionCostPerOrder: z.coerce.number().min(0),
    integratedPaperCostPerOrder: z.coerce.number().min(0),
    blankPaperCostPerOrder: z.coerce.number().min(0),

    // Other settings
    supplementaryItemCost: z.coerce.number().min(0),
    misprintCostMultiplier: z.coerce.number().min(0),
    costBufferPercentage: z.coerce.number().min(0).max(100),
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
                {/* Per-Item Production Costs */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Per-Item Production Costs</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="inkCostPerItem"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ink Cost Per Item ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="printerRepairCostPerItem"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Printer Repairs Per Item ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="pretreatCostPerItem"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Pretreat Cost Per Item ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="electricityCostPerItem"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Electricity Per Item ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="neckLabelCostPerItem"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Neck Labels Per Item ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="parchmentPaperCostPerItem"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Parchment Paper Per Item ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* Per-Order Fulfillment Costs */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Per-Order Fulfillment Costs</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="thankYouCardCostPerOrder"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Thank You Cards Per Order ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="polymailerCostPerOrder"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Polymailer Per Order ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="cleaningSolutionCostPerOrder"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cleaning Solution Per Order ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="integratedPaperCostPerOrder"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Integrated Paper Per Order ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="blankPaperCostPerOrder"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Blank Paper Per Order ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* Other Settings */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Other Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="supplementaryItemCost"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Supplementary Item Cost ($)</FormLabel>
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
                        <FormField
                            control={form.control}
                            name="costBufferPercentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cost Buffer Percentage (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="1" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Button type="submit" size="lg" className="w-full md:w-auto">Save Settings</Button>
            </form>
        </Form>
    );
}
