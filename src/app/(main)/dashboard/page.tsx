import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { activeOrderHolds, ordersGoneStale, ordersWithNoSessionHistory } from "@/lib/core/orders/get-unresolved-orders";
import { Icon } from "@iconify/react";
import { ArrowRightIcon, BookOpenIcon } from "lucide-react";
import Link from "next/link";
import { OrdersSheetCard } from "@/components/cards/orders-sheet-card";

// blank server component
export default async function DashboardPage() {
  await authorizePageUser("dashboard");

  const [activeHolds, staleOrders, noSessionHistory] = await Promise.all([
    activeOrderHolds(),
    ordersGoneStale(),
    ordersWithNoSessionHistory(),
  ]);

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <Link
        href="/sessions/create"
        className={buttonVariants({
          variant: "outline",
          className:
            "mt-4 h-18 rounded-xl! bg-white! hover:bg-zinc-50! text-black! hover:text-black! w-full flex items-center justify-between! px-8!",
        })}
      >
        <div className="flex items-center gap-2">
          <BookOpenIcon className="size-4" />
          Create a new session
        </div>
        <ArrowRightIcon className="size-4 text-zinc-400" />
      </Link>
      <div className="flex gap-4 mt-4 flex-wrap">
        <Link href="/holds?from=dashboard" className="block h-full">
          <Card className="sm:w-64 gap-2 h-full justify-between shadow-none bg-white hover:bg-zinc-50! transition-colors!">
            <CardHeader>
              <CardDescription className="flex items-center gap-1">
                <Icon icon="ph:call-bell" className="size-3" />
                Order Holds
              </CardDescription>
              <CardTitle className="text-4xl flex items-center gap-2 font-semibold tabular-nums @[250px]/card:text-3xl">
                {activeHolds.length}
              </CardTitle>
              <CardAction>
                <Icon icon="ph:caret-right" className="size-4" />
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div>Orders marked as on hold.</div>
            </CardFooter>
          </Card>
        </Link>

        <OrdersSheetCard
          orders={staleOrders}
          title="Stale Orders"
          description="Orders whose latest session was more than a week ago and have no active holds."
          icon="ph:hourglass"
          footerText="Orders gone stale."
        />

        <OrdersSheetCard
          orders={noSessionHistory}
          title="No Session History"
          description="Orders that have never been included in a session batch."
          icon="ph:clock-countdown"
          footerText="Orders with no session history."
        />
      </div>
    </div>
  );
}
