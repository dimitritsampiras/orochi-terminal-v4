"use client";

import { parseGid } from "@/lib/utils";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import dayjs from "dayjs";

interface Order {
  id: string;
  name: string;
  createdAt: Date | null;
  displayCustomerName: string | null;
}

interface OrdersSheetCardProps {
  orders: Order[];
  title: string;
  description: string;
  icon: string;
  footerText: string;
}

export function OrdersSheetCard({ orders, title, description, icon, footerText }: OrdersSheetCardProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Card className="sm:w-64! gap-2 shadow-none bg-white hover:bg-zinc-50! transition-colors! cursor-pointer">
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <Icon icon={icon} className="size-3" />
              {title}
            </CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2 font-semibold tabular-nums @[250px]/card:text-3xl">
              {orders.length}
            </CardTitle>
            <CardAction>
              <Icon icon="ph:eye" className="size-4" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div>{footerText}</div>
          </CardFooter>
        </Card>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] sm:max-w-none flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon icon={icon} className="size-4" />
            {title}
          </SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 -mx-4 px-4 h-0 min-h-0">
          {orders.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">No orders found</div>
          ) : (
            <div className="space-y-1 pb-4">
              {/* sort descing date */}
              {orders
                .toSorted((a, b) => {
                  return new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime();
                })
                .map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${parseGid(order.id)}?from=dashboard`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-100 transition-colors group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm group-hover:text-zinc-900">{order.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {order.displayCustomerName || "No customer name"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {order.createdAt ? dayjs(order.createdAt).format("MMM D, YYYY") : ""}
                      </span>
                      <Icon
                        icon="ph:caret-right"
                        className="size-4 text-zinc-400 group-hover:text-zinc-600 transition-colors"
                      />
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
