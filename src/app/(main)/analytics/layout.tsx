import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    // Restrict access to admin and super_admin roles
    await authorizePageUser("analytics");

    return (
        <div className="flex flex-col gap-6 p-6 w-full max-w-7xl mx-auto">
            <div className="flex items-center justify-between border-b pb-4">
                <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                <div className="flex gap-2">
                    <Link href="/analytics"><Button variant="ghost">Dashboard</Button></Link>
                    <Link href="/analytics/expenses"><Button variant="ghost">Expenses</Button></Link>
                    <Link href="/analytics/weekly-profitability"><Button variant="ghost">Weekly Profitability</Button></Link>
                    <Link href="/analytics/monthly-overview"><Button variant="ghost">Monthly Overview</Button></Link>
                    <Link href="/analytics/csv-upload-tool"><Button variant="ghost">Import CSV</Button></Link>
                    <Link href="/analytics/settings"><Button variant="ghost">Settings</Button></Link>
                </div>
            </div>
            {children}
        </div>
    );
}
