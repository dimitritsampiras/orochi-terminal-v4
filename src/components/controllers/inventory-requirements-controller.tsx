"use client";
import { useEffect, useMemo, useState } from "react";
import { DatePicker } from "../inputs/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { blanks, blankVariants, garmentSize, garmentType } from "@drizzle/schema";
import { Button, buttonVariants } from "../ui/button";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { toast } from "sonner";
import type { GetOrdersResponse, QueueResponse } from "@/lib/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from "../ui/dialog";
import { DialogClose, DialogDescription } from "@radix-ui/react-dialog";

type Blank = typeof blanks.$inferSelect & {
  blankVariants: (typeof blankVariants.$inferSelect)[];
};

type GarmentType = (typeof garmentType.enumValues)[number];
type GarmentSize = (typeof garmentSize.enumValues)[number];

const GARMENT_TABS: (GarmentType | "other")[] = [
  "hoodie",
  "crewneck",
  "longsleeve",
  "tee",
  "shorts",
  "sweatpants",
  "headwear",
  "accessory",
  "other",
];

const SIZES: GarmentSize[] = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];

// Issue types for products that can't be tracked
export type ProductIssue = {
  lineItemId: string;
  lineItemName: string;
  orderId: string;
  orderName: string;
  productId: string | null;
  reason: "missing_blank" | "missing_blank_variant" | "missing_product_variant";
};

// Per-blankVariant requirement data
export type BlankVariantRequirement = {
  blankVariantId: string;
  blankId: string;
  color: string;
  size: GarmentSize;
  required: number;
  available: number;
  deficit: number; // positive = need to order, negative = surplus
};

// Aggregated per-blank data for the table
export type BlankRequirementData = {
  blank: Blank;
  variants: Map<string, BlankVariantRequirement>; // keyed by "color@size"
  totalRequired: number;
  totalAvailable: number;
  totalDeficit: number;
};

// Summary stats
export type InventoryRequirementsSummary = {
  totalOrders: number;
  totalLineItems: number;
  processedLineItems: number;
  issueCount: number;
};

export const InventoryRequirementsController = ({ blanks }: { blanks: Blank[] }) => {
  const [startDate, setStartDate] = useState<Date | undefined>(dayjs().subtract(1, "month").toDate());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedTab, setSelectedTab] = useState<string>("hoodie");
  const [queuedOnly, setQueuedOnly] = useState<boolean>(true);

  const {
    data: orderQueue,
    refetch: refetchOrderQueue,
    isLoading: isLoadingOrderQueue,
    isSuccess: isSuccessOrderQueue,
    isError: isErrorOrderQueue,
  } = useQuery<QueueResponse>({
    queryKey: ["order-queue"],
    queryFn: async () => {
      const res = await fetch("/api/orders/queue");
      return res.json();
    },
    enabled: false,
  });

  const {
    data: orders,
    refetch: refetchOrders,
    isLoading: isLoadingOrders,
  } = useQuery<GetOrdersResponse>({
    queryKey: ["orders"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate.toISOString());
      if (endDate) params.set("end_date", endDate.toISOString());
      const res = await fetch(`/api/orders?${params.toString()}`);
      return res.json();
    },
    enabled: false,
  });

  const handleFetchOrders = async () => {
    toast.loading("Fetching...");
    if (queuedOnly) {
      await refetchOrderQueue();
      toast.dismiss();
    } else {
      await refetchOrders();
      toast.dismiss();
    }
  };

  useEffect(() => {
    if (isSuccessOrderQueue) {
      toast.dismiss();
      toast.success("Orders fetched!");
    }
  }, [isSuccessOrderQueue, orders]);

  useEffect(() => {
    if (isErrorOrderQueue) {
      toast.dismiss();
      toast.error("Failed to fetch orders");
    }
  }, [isErrorOrderQueue]);

  // Get the active orders data (either from queue or date range query)
  const activeOrders = useMemo(() => {
    if (queuedOnly) {
      return orderQueue?.data ?? [];
    }
    return orders?.data ?? [];
  }, [queuedOnly, orderQueue?.data, orders?.data]);

  // Build a lookup map for blankVariants: blankVariantId -> { blankId, color, size, quantity }
  const blankVariantLookup = useMemo(() => {
    const map = new Map<string, { blankId: string; color: string; size: GarmentSize; quantity: number }>();
    for (const blank of blanks) {
      for (const variant of blank.blankVariants) {
        map.set(variant.id, {
          blankId: blank.id,
          color: variant.color,
          size: variant.size,
          quantity: variant.quantity,
        });
      }
    }
    return map;
  }, [blanks]);

  // Build a lookup map for blanks by id
  const blankLookup = useMemo(() => {
    const map = new Map<string, Blank>();
    for (const blank of blanks) {
      map.set(blank.id, blank);
    }
    return map;
  }, [blanks]);

  // Process orders to compute inventory requirements
  const inventoryAnalysis = useMemo(() => {
    const issues: ProductIssue[] = [];
    const requirementsByBlankVariant = new Map<string, number>(); // blankVariantId -> required qty

    let totalLineItems = 0;
    let processedLineItems = 0;

    // DEBUG counters
    let skippedNoProductVariant = 0;
    let skippedBlackLabel = 0;
    let skippedNoBlank = 0;
    let skippedNoBlankVariant = 0;
    let validLineItems = 0;

    for (const order of activeOrders) {
      for (const lineItem of order.lineItems.filter((item) => item.requiresShipping)) {
        totalLineItems++;

        const product = lineItem.product;
        const productVariant = lineItem.productVariant;

        // Issue: Line item has no product variant linked
        if (!productVariant) {
          skippedNoProductVariant++;
          issues.push({
            lineItemId: lineItem.id,
            lineItemName: lineItem.name,
            orderId: order.id,
            orderName: order.name,
            productId: lineItem.productId,
            reason: "missing_product_variant",
          });
          continue;
        }

        // If product is blackLabel, we don't track blank inventory for it
        if (product?.isBlackLabel) {
          skippedBlackLabel++;
          processedLineItems++;
          continue;
        }

        // Issue: Product doesn't have a blank assigned (and isn't blackLabel)
        if (!product?.blankId) {
          skippedNoBlank++;
          issues.push({
            lineItemId: lineItem.id,
            lineItemName: lineItem.name,
            orderId: order.id,
            orderName: order.name,
            productId: lineItem.productId,
            reason: "missing_blank",
          });
          continue;
        }

        // Issue: Product variant doesn't have a blankVariant linked
        if (!productVariant.blankVariantId) {
          skippedNoBlankVariant++;
          issues.push({
            lineItemId: lineItem.id,
            lineItemName: lineItem.name,
            orderId: order.id,
            orderName: order.name,
            productId: lineItem.productId,
            reason: "missing_blank_variant",
          });
          continue;
        }

        // Valid: count the requirement
        validLineItems++;
        const currentQty = requirementsByBlankVariant.get(productVariant.blankVariantId) ?? 0;
        requirementsByBlankVariant.set(productVariant.blankVariantId, currentQty + (lineItem.quantity ?? 1));
        processedLineItems++;
      }
    }

    // Build per-blank aggregated data
    const blankRequirements = new Map<string, BlankRequirementData>();

    let lookupMisses = 0;
    let blankMisses = 0;

    for (const [blankVariantId, requiredQty] of requirementsByBlankVariant) {
      const variantInfo = blankVariantLookup.get(blankVariantId);
      if (!variantInfo) {
        lookupMisses++;
        continue;
      }

      const blank = blankLookup.get(variantInfo.blankId);
      if (!blank) {
        blankMisses++;
        continue;
      }

      // Get or create the blank requirement data
      let blankReq = blankRequirements.get(blank.id);
      if (!blankReq) {
        blankReq = {
          blank,
          variants: new Map(),
          totalRequired: 0,
          totalAvailable: 0,
          totalDeficit: 0,
        };
        blankRequirements.set(blank.id, blankReq);
      }

      const key = `${variantInfo.color}@${variantInfo.size}`;
      const deficit = requiredQty - variantInfo.quantity;

      blankReq.variants.set(key, {
        blankVariantId,
        blankId: blank.id,
        color: variantInfo.color,
        size: variantInfo.size,
        required: requiredQty,
        available: variantInfo.quantity,
        deficit,
      });

      blankReq.totalRequired += requiredQty;
      blankReq.totalAvailable += variantInfo.quantity;
      blankReq.totalDeficit += Math.max(0, deficit); // only count positive deficits
    }

    const summary: InventoryRequirementsSummary = {
      totalOrders: activeOrders.length,
      totalLineItems,
      processedLineItems,
      issueCount: issues.length,
    };

    return {
      issues,
      blankRequirements,
      summary,
    };
  }, [activeOrders, blankVariantLookup, blankLookup]);

  // Filter blank requirements by selected garment type tab
  const filteredBlankRequirements = useMemo(() => {
    const result: BlankRequirementData[] = [];
    for (const blankReq of inventoryAnalysis.blankRequirements.values()) {
      if (selectedTab === "other") {
        if (!GARMENT_TABS.includes(blankReq.blank.garmentType)) {
          result.push(blankReq);
        }
      } else if (blankReq.blank.garmentType === selectedTab) {
        result.push(blankReq);
      }
    }
    return result;
  }, [inventoryAnalysis.blankRequirements, selectedTab]);

  return (
    <div>
      <div className="flex items-end justify-between gap-2 h-16">
        <div className="flex items-end gap-2 h-16">
          <DatePicker
            disabled={isLoadingOrderQueue || isLoadingOrders || queuedOnly}
            label="Start Date"
            value={startDate}
            onChange={(date) => {
              setStartDate(date);
            }}
          />
          <DatePicker
            disabled={isLoadingOrderQueue || isLoadingOrders || queuedOnly}
            label="End Date"
            value={endDate}
            onChange={(date) => {
              setEndDate(date);
            }}
          />
          <div className="border-r border-zinc-200 h-full mx-4"></div>
          <Button
            disabled={isLoadingOrderQueue || isLoadingOrders}
            variant={queuedOnly ? "fill" : "outline"}
            onClick={() => setQueuedOnly(!queuedOnly)}
            className={cn(!queuedOnly && "text-zinc-500")}
          >
            {queuedOnly ? (
              <Icon icon="ph:check-circle-fill" className="size-4" />
            ) : (
              <Icon icon="ph:circle" className="size-4" />
            )}
            Queued Orders
          </Button>
        </div>
        <Button
          loading={isLoadingOrderQueue || isLoadingOrders}
          disabled={!queuedOnly && !startDate}
          onClick={handleFetchOrders}
        >
          Fetch {queuedOnly ? "Queue" : "Orders"}
        </Button>
      </div>
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mt-4">
        <div className="w-full overflow-y-scroll flex items-center px-2 rounded-full h-12 bg-zinc-100">
          <TabsList>
            {GARMENT_TABS.map((type) => (
              <TabsTrigger key={type} value={type} className="capitalize">
                {type}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {inventoryAnalysis.summary && (
          <div className="flex items-center gap-8 my-4 px-2">
            <div>
              <div className="text-xs text-muted-foreground">Total Orders:</div>
              <div className="font-medium text-lg">{inventoryAnalysis.summary.totalOrders}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Items:</div>
              <div className="font-medium text-lg">{inventoryAnalysis.summary.processedLineItems}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Issues:</div>
              <div className="flex gap-2 items-center">
                <div className={cn("font-medium text-lg", inventoryAnalysis.summary.issueCount > 0 && "text-red-700")}>
                  {inventoryAnalysis.summary.issueCount}
                </div>
                <Dialog>
                  <DialogTrigger className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
                    <Icon icon="ph:eye" className="size-3" />
                  </DialogTrigger>
                  <DialogContent>
                    <DialogTitle>Issues</DialogTitle>

                    <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                      {inventoryAnalysis.issues.map((issue) => (
                        <div key={issue.lineItemId} className="flex items-center justify-between">
                          <div className="text-red-700">
                            <span className="font-medium">{issue.orderName}</span>: {issue.lineItemName}
                          </div>
                          <div>
                            {issue.reason === "missing_blank" && "No blank assigned"}
                            {issue.reason === "missing_blank_variant" && "No blank variant linked"}
                            {issue.reason === "missing_product_variant" && "Line item has no lined product"}
                          </div>
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
              </div>
            </div>
          </div>
        )}

        {GARMENT_TABS.map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            {filteredBlankRequirements.length === 0 ? (
              <div className="text-zinc-500 bg-zinc-100 w-full flex items-center justify-center p-4 h-30 rounded-lg">
                No blanks with requirements found
              </div>
            ) : (
              filteredBlankRequirements.map((req) => <BlankRequirementCard key={req.blank.id} data={req} />)
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

function BlankRequirementCard({ data }: { data: BlankRequirementData }) {
  // Get unique colors from the variants map, sorted
  const colors = useMemo(() => {
    const colorSet = new Set<string>();
    for (const variant of data.variants.values()) {
      colorSet.add(variant.color);
    }
    return Array.from(colorSet).sort((a, b) => a.localeCompare(b));
  }, [data.variants]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <CardTitle className="capitalize">
            {data.blank.blankCompany} {data.blank.blankName}
          </CardTitle>
          <div className="text-sm text-muted-foreground capitalize">{data.blank.garmentType}</div>
        </div>
        <div className="text-sm text-right">
          <div>
            Required: <span className="font-medium">{data.totalRequired}</span>
          </div>
          {data.totalDeficit > 0 && (
            <div className="text-red-600">
              Deficit: <span className="font-medium">{data.totalDeficit}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Color</TableHead>
              {SIZES.map((size) => (
                <TableHead key={size} className="text-center uppercase">
                  {size}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {colors.map((color) => (
              <TableRow key={color}>
                <TableCell className="font-medium">{color}</TableCell>
                {SIZES.map((size) => {
                  const key = `${color}@${size}`;
                  const variant = data.variants.get(key);

                  return (
                    <TableCell key={size}>
                      <div className="flex items-center justify-center h-full w-full py-2">
                        {variant ? (
                          <div className="text-center flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs gap-2">
                              <div className="text-muted-foreground">Required:</div>
                              <div className="font-medium">{variant.required}</div>
                            </div>
                            <div className="flex items-center justify-between text-xs gap-2">
                              <div className="text-muted-foreground">On Hand:</div>
                              <div className="font-medium">{variant.available}</div>
                            </div>
                            {variant.deficit > 0 ? (
                              <Badge className="w-full text-[10px] text-red-700" variant="outline">
                                Deficit: <span className="font-semibold">{variant.deficit}</span>
                              </Badge>
                            ) : (
                              <Badge className="w-full text-[10px] text-blue-700" variant="outline">
                                Stocked: <span className="font-semibold">{Math.abs(variant.deficit)}</span>
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="h-8 text-zinc-300 rounded-md w-16 flex items-center justify-center">—</div>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {colors.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={SIZES.length + 1}
                  className="bg-zinc-100 h-20 p-4 text-center text-muted-foreground"
                >
                  No variants with requirements found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
