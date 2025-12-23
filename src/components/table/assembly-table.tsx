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

export function AssemblyTable({ assemblyLine, batchId }: { assemblyLine: SortedAssemblyLineItem[]; batchId: number }) {
  const [filter, setFilter] = useState("");
  const router = useRouter();
  const { start } = useProgress();
  const { setNavigation } = useAssemblyNavigation();
  const filteredItems = assemblyLine.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()));

  const handleRowClick = (id: string) => {
    start();
    router.push(`/assembly/${parseGid(id)}`);
    // The progress will automatically complete when navigation finishes
    // setNavigation(assemblyLine.map((item, index) => ({ id: item.id, itemPosition: index })));
  };

  return (
    <div className="mt-4">
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
