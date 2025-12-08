import { db } from '@/lib/clients/db';
import { createClient } from '@/lib/clients/supabase-server';
import type { EditProductResponse } from '@/lib/types/misc';
import { type NextRequest, NextResponse } from 'next/server';
import {
  categories,
  linkedProducts,
  products,
  productsCategories,
  users
} from '../../../../../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';
import { editProductSchema } from '@/lib/schemas/product-schema';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ product_id: string }> }
): Promise<NextResponse<EditProductResponse>> {
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
  const { success, data: body } = editProductSchema.safeParse(rawBody);

  console.log('body', body);

  if (!success) {
    return NextResponse.json({ data: null, error: 'Invalid request body' }, { status: 400 });
  }

  const product = (await db.select().from(products).where(eq(products.id, productId)))[0];

  if (!product) {
    return NextResponse.json({ data: null, error: 'Product not found' }, { status: 404 });
  }

  const updateData: Partial<typeof products.$inferInsert> = {};

  if (body.name) updateData.name = body.name;
  if (body.longDescription) updateData.description = body.longDescription;
  if (body.shortDescription) updateData.shortDescription = body.shortDescription;
  if (body.price) updateData.price = body.price;
  if (body.imageUrl) updateData.imgUrl = body.imageUrl;
  if (body.active !== undefined) updateData.active = body.active;

  // check if empty
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ data: null, error: 'No data to update' }, { status: 400 });
  }

  await db.update(products).set(updateData).where(eq(products.id, productId));

  // Handle categories (only if either categoryIds or newCategories is provided)
  if (body.categoryIds !== undefined || body.newCategories !== undefined) {
    // Create new categories first
    let newCategoryIds: number[] = [];
    if (body.newCategories && body.newCategories.length > 0) {
      const existingNewCategories = await db
        .select()
        .from(categories)
        .where(inArray(categories.name, body.newCategories));

      const newFilteredCategories = body.newCategories.filter(
        (category) => !existingNewCategories.some((c) => c.name === category)
      );

      if (newFilteredCategories.length > 0) {
        const response = await db
          .insert(categories)
          .values(
            newFilteredCategories.map<typeof categories.$inferInsert>((category) => ({
              name: category
            }))
          )
          .returning();

        newCategoryIds = response.map((c) => c.id);
      }
    }

    // Combine all desired category IDs
    const allDesiredCategoryIds = [...(body.categoryIds || []), ...newCategoryIds];

    // Replace all categories with the combined list
    await db.delete(productsCategories).where(eq(productsCategories.productId, product.id));

    if (allDesiredCategoryIds.length > 0) {
      await db
        .insert(productsCategories)
        .values(
          allDesiredCategoryIds.map((id) => ({ productId: product.id, categoryId: id }))
        );
    }
  }

  // Add upsell handling
  if (body.upsellIds !== undefined) {
    // Remove existing upsells
    await db.delete(linkedProducts).where(eq(linkedProducts.productId, product.id));

    if (body.upsellIds.length > 0) {
      await db.insert(linkedProducts).values(
        body.upsellIds.map<typeof linkedProducts.$inferInsert>((id) => ({
          linkedId: id,
          productId: product.id
        }))
      );
    }
  }

  return NextResponse.json({ data: 'success', error: null });
}
