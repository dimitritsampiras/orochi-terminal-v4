"use client";

import { useState } from "react";
import { SortedAssemblyLineItem } from "@/lib/core/session/create-assembly-line";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { colorNameToHex } from "@/lib/core/products/color-name-to-hex";
import { LineItemStatusBadge } from "../badges/line-item-status-badge";
import { Input } from "../ui/input";
import { cn, parseGid } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAssemblyNavigation } from "@/lib/stores";
import Link from "next/link";
import { useProgress } from "@bprogress/next";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button, buttonVariants } from "../ui/button";
import { Icon } from "@iconify/react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "../ui/dialog";

export function AssemblyTable({ assemblyLine, batchId }: { assemblyLine: SortedAssemblyLineItem[]; batchId: number }) {
  const [filter, setFilter] = useState("");
  const router = useRouter();
  const { start } = useProgress();
  const { setNavigation } = useAssemblyNavigation();
  const filteredItems = assemblyLine.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()));

  const itemsWithUnsyncedPrints = filteredItems.filter(
    (item) => item.prints.length === 0 && !Boolean(item.product?.isBlackLabel)
  );

  const handleRowClick = (id: string) => {
    start();
    router.push(`/assembly/${parseGid(id)}`);
    // The progress will automatically complete when navigation finishes
    // setNavigation(assemblyLine.map((item, index) => ({ id: item.id, itemPosition: index })));
  };

  return (
    <div className="mt-4">
      {itemsWithUnsyncedPrints.length > 0 && (
        <Card className="@container/card bg-red-50 max-w-96 gap-2 my-4">
          <CardHeader>
            <CardDescription>Items with Unsynced Prints</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2 font-semibold tabular-nums @[250px]/card:text-3xl text-red-700">
              <Icon icon="ph:warning-circle-bold" className="size-6" />
              {itemsWithUnsyncedPrints.length}
            </CardTitle>
            <CardAction>
              <Dialog>
                <DialogTrigger>
                  <Button variant="fill">View Items</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Unsynced Prints</DialogTitle>
                  <DialogDescription>
                    <div>These need to be adjusted before beginning printing.</div>
                  </DialogDescription>
                  <div>
                    {itemsWithUnsyncedPrints
                      .filter((item) => item.product?.id)
                      .map((item) => (
                        <div className="flex items-center gap-2 justify-between" key={item.id}>
                          <Link
                            key={item.id}
                            href={`/products/${parseGid(item.product?.id ?? "")}`}
                            className={buttonVariants({ variant: "link", className: "px-0! mx-0!" })}
                          >
                            {item.name}
                          </Link>
                          <div className="text-sm text-zinc-500">{item.prints.length} prints</div>
                        </div>
                      ))}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Close</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div>These need to be adjusted before beginning printing.</div>
          </CardFooter>
        </Card>
      )}
      <div className="mb-4">
        <Input
          placeholder="Filter by item name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="overflow-clip rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Position</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>Blank Color</TableHead>
              <TableHead>Blank Size</TableHead>
              <TableHead>Has Heat Transfer</TableHead>
              <TableHead>Completion Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item, index) => {
              const heatTransferPrint = item.prints.find((print) => Boolean(print.heatTransferCode));

              return (
                <TableRow
                  key={item.id}
                  className={cn(index % 2 === 0 && "bg-gray-50")}
                  onClick={() => handleRowClick(item.id)}
                >
                  <TableCell className="font-medium">{item.itemPosition + 1}</TableCell>
                  <TableCell className="font-semibold">
                    <div className="max-w-[300px] text-wrap">{item.name}</div>
                  </TableCell>
                  <TableCell className="capitalize">
                    {item.blankVariant?.color ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{ backgroundColor: colorNameToHex(item.blankVariant.color) }}
                        />
                        <span className="capitalize">{item.blankVariant.color}</span>
                      </div>
                    ) : (
                      "--"
                    )}
                  </TableCell>

                  <TableCell className="capitalize">{item.blankVariant?.size ?? "--"}</TableCell>
                  <TableCell>
                    {item.product?.isBlackLabel ? (
                      <Badge className="bg-violet-50 text-violet-700">Black Label</Badge>
                    ) : item.blankVariant && item.prints ? (
                      heatTransferPrint ? (
                        <Badge variant="secondary">
                          {heatTransferPrint?.heatTransferCode}
                          {heatTransferPrint?.isSmallPrint && " (Small)"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className=" text-zinc-500">
                          No Heat Transfer
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-zinc-400! border-zinc-100!">
                        No Prints Specified
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-left">
                    <LineItemStatusBadge status={item.completionStatus} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
