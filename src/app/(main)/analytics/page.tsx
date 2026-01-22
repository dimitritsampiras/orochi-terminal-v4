import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/clients/db";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

import { OverviewDashboard } from "./OverviewDashboard";

import { QueuedOrdersDashboard } from "./QueuedOrdersDashboard";

export default async function AnalyticsDashboard() {
    const batches = await db.query.batches.findMany({
        orderBy: (batches, { desc }) => [desc(batches.createdAt)],
        limit: 50
    });

    return (
        <div className="space-y-8">
            <QueuedOrdersDashboard />
            <OverviewDashboard />

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Recent Batches</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {batches.map(batch => (
                        <Link key={batch.id} href={`/analytics/batch/${batch.id}`}>
                            <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-lg font-medium">Batch #{batch.id}</CardTitle>
                                    {batch.active ? (
                                        <Badge variant="default">Active</Badge>
                                    ) : (
                                        <Badge variant="secondary">Settled</Badge>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground mt-2">
                                        <p>Created: {new Date(batch.createdAt).toLocaleDateString()}</p>
                                        {batch.settledAt && <p>Settled: {new Date(batch.settledAt).toLocaleDateString()}</p>}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
