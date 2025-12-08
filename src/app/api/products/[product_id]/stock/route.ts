import { db } from '@/lib/clients/db';
import { createClient } from '@/lib/clients/supabase-server';
import { type NextRequest, NextResponse } from 'next/server';
import { products, stock, users } from '../../../../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { updateProductStockSchema } from '@/lib/schemas/product-schema';
import type { UpdateProductStockResponse } from '@/lib/types/misc';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { product_id: string } }
): Promise<NextResponse<UpdateProductStockResponse>> {
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

  const { product_id } = await params;
  const productId = Number(product_id);

  if (Number.isNaN(productId)) {
    return NextResponse.json({ data: null, error: 'Invalid product ID' }, { status: 400 });
  }

  const rawBody = await req.json();

  const { success, data: body } = updateProductStockSchema.safeParse(rawBody);

  if (!success) {
    return NextResponse.json({ data: null, error: 'Invalid request body' }, { status: 400 });
  }

  try {
    // Add this one check to prevent orphaned stock records
    const [product] = await db.select().from(products).where(eq(products.id, productId));
    if (!product) {
      return NextResponse.json({ data: null, error: 'Product not found' }, { status: 404 });
    }

    await Promise.all(
      body.stock.map(async ({ locationId, value, stockId }) => {
        if (stockId) {
          await db
            .update(stock)
            .set({
              value
            })
            .where(eq(stock.id, stockId));
        } else {
          await db.insert(stock).values({
            productId,
            locationId,
            value
          });
        }
      })
    );
    return NextResponse.json({ data: 'success', error: null });
  } catch (error) {
    console.error('Failed to update stock:', error);
    return NextResponse.json({ data: null, error: 'Failed to update stock' }, { status: 500 });
  }
}
