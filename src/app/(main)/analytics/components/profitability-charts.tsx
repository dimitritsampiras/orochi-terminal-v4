"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CostBreakdownProps = {
    costs: {
        shipping: number;
        blanks: number;
        inkAndSupplies: number;
        expenses: number;
    };
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export function CostBreakdownChart({ costs }: CostBreakdownProps) {
    const data = [
        { name: "Shipping", value: costs.shipping },
        { name: "Blanks", value: costs.blanks },
        { name: "Ink & Supplies", value: costs.inkAndSupplies },
        { name: "Expenses", value: costs.expenses },
    ].filter((item) => item.value > 0);

    return (
        <Card className="col-span-1 h-full">
            <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
