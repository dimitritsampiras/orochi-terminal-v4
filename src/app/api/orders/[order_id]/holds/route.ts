import { db } from "@/lib/clients/db";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { logger } from "@/lib/core/logger";
import { createOrderHoldSchema } from "@/lib/schemas/order-hold-schema";
import { buildResourceGid } from "@/lib/utils";
import { orderHolds, orders } from "@drizzle/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ order_id: string }> }) {
  try {
    const user = await authorizeApiUser(["super_admin", "admin", "customer_support"]);

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { order_id } = await params;
    const orderId = buildResourceGid("Order", order_id);

    // Get the order to fetch the order number
    const order = await db.query.orders.findFirst({
      where: { id: orderId },
      columns: { name: true },
    });

    if (!order) {
      return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
    }

    // Check for existing unresolved hold
    const existingHold = await db.query.orderHolds.findFirst({
      where: { orderId, isResolved: false }
    });

    if (existingHold) {
      return NextResponse.json({ data: null, error: "Order already has an active hold" }, { status: 400 });
    }

    const body = await request.json();
    const { cause, reasonNotes } = createOrderHoldSchema.parse(body);

    const [hold] = await db
      .insert(orderHolds)
      .values({
        orderId,
        orderNumber: order.name,
        cause,
        reasonNotes,
      })
      .returning();

    // Log the action
    await logger.info(`Order hold created: ${cause} - ${reasonNotes} by ${user.username}`, {
      orderId,
      profileId: user.id,
      metadata: { holdId: hold.id, cause },
    });

    return NextResponse.json({ data: hold, error: null });
  } catch (error) {
    console.error("Error creating order hold:", error);
    return NextResponse.json({ data: null, error: "Failed to create order hold" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ order_id: string }> }) {
  try {
    const user = await authorizeApiUser(["super_admin", "admin", "customer_support", "warehouse_staff"]);

    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { order_id } = await params;
    const orderId = buildResourceGid("Order", order_id);

    const holds = await db.query.orderHolds.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: holds, error: null });
  } catch (error) {
    console.error("Error fetching order holds:", error);
    return NextResponse.json({ data: null, error: "Failed to fetch order holds" }, { status: 500 });
  }
}

