import { db } from '@/lib/clients/db';
import { createClient } from '@/lib/clients/supabase-server';
import { type NextRequest, NextResponse } from 'next/server';
import { orders, ordersProducts, products, users } from '../../../../../drizzle/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { editOrderSchema } from '@/lib/schemas/orders-schema';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ order_id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user: authUser }
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, authUser.id));

  if (!user) {
    return NextResponse.json({ data: null, error: 'User not found' }, { status: 404 });
  }

  if (!['super_admin', 'admin'].includes(user.role) || user.active === false) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  const { order_id } = await params;

  const rawBody = await req.json();
  const { success, data: body } = editOrderSchema.safeParse(rawBody);

  if (!success) {
    return NextResponse.json({ data: null, error: 'Invalid request body' }, { status: 400 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, order_id));

  if (!order) {
    return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
  }

  try {
    const updateData: Partial<typeof orders.$inferInsert> = {};

    if (body.assignedTo !== undefined) updateData.assignedTo = body.assignedTo;
    if (body.paid !== undefined) updateData.paid = body.paid;
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    if (body.deliveryType !== undefined) updateData.deliveryType = body.deliveryType;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.bookingDate !== undefined) updateData.bookingDate = body.bookingDate;

    if (Object.keys(updateData).length > 0) {
      await db.update(orders).set(updateData).where(eq(orders.id, order_id));
    }

    if (body.removedProducts && body.removedProducts.length > 0) {
      const productIdsToRemove = body.removedProducts.map((id) => id);

      await db
        .delete(ordersProducts)
        .where(
          and(
            eq(ordersProducts.orderId, order_id),
            inArray(ordersProducts.productId, productIdsToRemove)
          )
        );
    }

    if (body.addedProducts && body.addedProducts.length > 0) {
      const existingProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, body.addedProducts));

      if (existingProducts.length !== body.addedProducts.length) {
        return NextResponse.json(
          { data: null, error: 'One or more products not found' },
          { status: 400 }
        );
      }

      const existingOrderProducts = await db
        .select({ productId: ordersProducts.productId })
        .from(ordersProducts)
        .where(
          and(
            eq(ordersProducts.orderId, order_id),
            inArray(ordersProducts.productId, body.addedProducts)
          )
        );

      const newProductIds = body.addedProducts.filter(
        (id) => !existingOrderProducts.some((op) => op.productId === id)
      );

      if (newProductIds.length > 0) {
        await db.insert(ordersProducts).values(
          newProductIds.map((productId) => ({
            orderId: order_id,
            productId: productId,
            qty: 1
          }))
        );
      }
    }

    return NextResponse.json({ data: 'success', error: null });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ data: null, error: 'Failed to update order' }, { status: 500 });
  }
}
