import { db } from "@/lib/clients/db";
import { DataResponse } from "@/lib/types/misc";

import { PickingRequirement, pickingRequirementsSchema } from "./create-picking-requirements";
import { inventoryTransactions, lineItemCompletionStatus } from "@drizzle/schema";

export type SettlementItem = {
  lineItemId: string;
  lineItemName: string;
  orderId: string;
  orderName: string;
  expectedFulfillmentType: PickingRequirement["expectedFulfillmentType"] | null;
  lineItemStatus: (typeof lineItemCompletionStatus.enumValues)[number];
  expectedStockChange: {
    inventoryType: "blankVariant" | "productVariant";
    inventoryTypeId: string;
    inventoryDisplayName: string;
    change: number;
  } | null;
  actualStockChange: {
    isMismatchedWithExpected: boolean;
    totalChangeAmount: number;
    changes: {
      inventoryType: "blankVariant" | "productVariant";
      inventoryTypeId: string;
      inventoryDisplayName: string;
      change: number;
      transaction: typeof inventoryTransactions.$inferSelect;
    }[];
  } | null;
  issues: string[];
};

export const getSettlementData = async (batchId: number): Promise<DataResponse<SettlementItem[]>> => {
  const batch = await db.query.batches.findFirst({
    where: { id: batchId },
    with: {
      orders: {
        with: {
          lineItems: true,
        },
      },
    },
  });

  if (!batch) {
    return { data: null, error: "Could not find session" };
  }

  if (!batch.pickingListJson) {
    return {
      data: null,
      error: "No picking requirements for session. Either this session is old or picking docs were never generated",
    };
  }

  const { data: parsedPickingRequirments } = pickingRequirementsSchema.safeParse(batch.pickingListJson);

  if (!parsedPickingRequirments) {
    return { data: null, error: "Failed to parse picking requirements" };
  }

  const transactions = await db.query.inventoryTransactions.findMany({
    where: { batchId: batchId },
  });

  const [blankVariantsUsed, productVariantsUsed] = await Promise.all([
    db.query.blankVariants.findMany({
      where: {
        id: {
          in: transactions
            .filter((transaction) => transaction.blankVariantId)
            .map((transaction) => transaction.blankVariantId!),
        },
      },
      with: {
        blank: {
          columns: {
            blankCompany: true,
            blankName: true,
          },
        },
      },
    }),
    db.query.productVariants.findMany({
      where: {
        id: {
          in: transactions
            .filter((transaction) => transaction.productVariantId)
            .map((transaction) => transaction.productVariantId!),
        },
      },
      with: {
        product: {
          columns: {
            title: true,
          },
        },
      },
    }),
  ]);

  const blankVariantsUsedMap = new Map(blankVariantsUsed.map((blankVariant) => [blankVariant.id, blankVariant]));
  const productVariantsUsedMap = new Map(
    productVariantsUsed.map((productVariant) => [productVariant.id, productVariant])
  );

  if (!transactions) {
    return { data: null, error: "No inventory transactions found for session" };
  }

  const sessionLineItems = batch.orders.flatMap((order) => order.lineItems);

  const settlementItems = [];

  for (const lineItem of sessionLineItems.map((lineItem) => ({
    ...lineItem,
    order: batch.orders.find((order) => order.id === lineItem.orderId),
  }))) {
    const settlementItem: SettlementItem = {
      lineItemStatus: lineItem.completionStatus,
      lineItemId: lineItem.id,
      lineItemName: lineItem.name,
      orderId: lineItem.orderId,
      orderName: lineItem.order?.name ?? "???",
      expectedFulfillmentType: null,
      expectedStockChange: null,
      actualStockChange: null,
      issues: [],
    };
    const pickingRequirementItem = parsedPickingRequirments.find(
      (requirement) => requirement.lineItemId === lineItem.id
    );
    if (!pickingRequirementItem) {
      // this is a problem that needs to be logged
      settlementItem.issues.push("Picking requirement not found");
      settlementItems.push(settlementItem);
      continue;
    }

    const lineItemTransactions = transactions.filter((transaction) => transaction.lineItemId === lineItem.id);

    /**
     * we now have:
     *   1. line item
     *   2. picking requirement item
     *   3. transaction for that item
     * we need to find -> stock mismatch
     */
    let expectedStockChange: SettlementItem["expectedStockChange"] = null;

    if (pickingRequirementItem.expectedFulfillmentType === "stock" && pickingRequirementItem.productVariantId) {
      expectedStockChange = {
        inventoryType: "productVariant",
        inventoryDisplayName: pickingRequirementItem.productDisplayName ?? "",
        inventoryTypeId: pickingRequirementItem.productVariantId,
        change: -pickingRequirementItem.quantity,
      };
    } else if (pickingRequirementItem.expectedFulfillmentType === "print" && pickingRequirementItem.blankVariantId) {
      expectedStockChange = {
        inventoryType: "blankVariant",
        inventoryDisplayName: pickingRequirementItem.blankDisplayName ?? "",
        inventoryTypeId: pickingRequirementItem.blankVariantId,
        change: -pickingRequirementItem.quantity,
      };
    }

    if (!expectedStockChange) {
      settlementItem.issues.push("Unable to get expected stock change found");
      settlementItems.push(settlementItem);
      continue;
    }

    const actualStockChanges: NonNullable<SettlementItem["actualStockChange"]>["changes"] = [];
    if (lineItem.name === "Spiral Passage Tee - Navy - Medium") {
      console.log(lineItemTransactions);
    }

    for (const transaction of lineItemTransactions) {
      // if (transaction.reason === "assembly_usage") {
      if (transaction.blankVariantId && transaction.blankVariantId !== pickingRequirementItem.blankVariantId) {
        settlementItem.issues.push("Blank variant mismatch");
        continue;
      }
      if (transaction.productVariantId && transaction.productVariantId !== pickingRequirementItem.productVariantId) {
        settlementItem.issues.push("Product variant mismatch");
        continue;
      }

      const inventoryDisplayName = transaction.blankVariantId
        ? blankVariantsUsedMap.get(transaction.blankVariantId!)?.blank?.blankCompany +
          " " +
          blankVariantsUsedMap.get(transaction.blankVariantId!)?.blank?.blankName
        : productVariantsUsedMap.get(transaction.productVariantId!)?.product?.title ?? "";

      actualStockChanges.push({
        inventoryType: transaction.blankVariantId ? "blankVariant" : "productVariant",
        inventoryTypeId: transaction.blankVariantId ?? transaction.productVariantId!,
        change: transaction.changeAmount,
        inventoryDisplayName: inventoryDisplayName,
        transaction: transaction,
      });
      // }
    }

    settlementItem.expectedStockChange = expectedStockChange;

    const totalInventoryChange = actualStockChanges.reduce((acc, change) => acc + change.change, 0);

    settlementItem.actualStockChange = {
      isMismatchedWithExpected: totalInventoryChange !== expectedStockChange.change,
      totalChangeAmount: actualStockChanges.reduce((acc, change) => acc + change.change, 0),
      changes: actualStockChanges,
    };

    settlementItem.expectedFulfillmentType = pickingRequirementItem.expectedFulfillmentType;
    settlementItems.push(settlementItem);
  }

  return { data: settlementItems.toSorted((a, b) => a.orderName.localeCompare(b.orderName)), error: null };
};
