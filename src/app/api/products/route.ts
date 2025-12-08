import { db } from '@/lib/clients/db';
import { NextResponse, type NextRequest } from 'next/server';
import {
  categories,
  linkedProducts,
  locations,
  products,
  productsCategories,
  stock,
  users
} from '../../../../drizzle/schema';
import type { CreateProductResponse, GetProductsResponse } from '@/lib/types/misc';
import { countDistinct, desc, eq, ilike, inArray } from 'drizzle-orm';
import { createProductSchema } from '@/lib/schemas/product-schema';
import { createClient } from '@/lib/clients/supabase-server';
import { alias } from 'drizzle-orm/pg-core';

export async function GET(request: NextRequest): Promise<NextResponse<GetProductsResponse>> {
  const PAGE_SIZE = 15; // TODO: move to page.tsx not api

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q');
  const status = searchParams.getAll('status');

  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1') || 1);

  const offset = (page - 1) * PAGE_SIZE;

  console.log('page', page, PAGE_SIZE, offset);

  try {
    const countQuery = db
      .select({ count: countDistinct(products.id) })
      .from(products)
      .innerJoin(productsCategories, eq(products.id, productsCategories.productId))
      .innerJoin(categories, eq(productsCategories.categoryId, categories.id))
      .$dynamic();

    const productIdsQuery = db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset)
      .$dynamic();

    if (q) {
      const condition = ilike(products.name, `%${q}%`); //TODO: change later to search term column
      countQuery.where(condition);
      productIdsQuery.where(condition);
    }

    if (status.length > 0) {
      const condition = inArray(
        products.active,
        status.map((s) => s === 'active')
      );
      countQuery.where(condition);
      productIdsQuery.where(condition);
    }

    const [countResult, productIdsResult] = await Promise.all([countQuery, productIdsQuery]);

    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const productIds = productIdsResult.map((p) => p.id);

    console.log({
      total,
      totalPages,
      currentPage: page
    });

    if (productIds.length === 0) {
      return NextResponse.json({
        data: {
          products: [],
          pagination: {
            total,
            totalPages,
            currentPage: page
          }
        },
        error: null
      });
    }

    const linkedProductsAlias = alias(products, 'linked_product');

    const prodsRaw = await db
      .select({
        product: products,
        category: categories,
        stock: stock,
        location: locations,
        upsellProduct: linkedProductsAlias
      })
      .from(products)
      .where(inArray(products.id, productIds))
      .leftJoin(productsCategories, eq(products.id, productsCategories.productId))
      .leftJoin(categories, eq(productsCategories.categoryId, categories.id))
      .leftJoin(stock, eq(products.id, stock.productId))
      .leftJoin(locations, eq(stock.locationId, locations.id))
      .leftJoin(linkedProducts, eq(products.id, linkedProducts.productId))
      .leftJoin(linkedProductsAlias, eq(linkedProducts.linkedId, linkedProductsAlias.id))
      .orderBy(desc(products.createdAt));

    const productsMap = new Map<
      number,
      NonNullable<GetProductsResponse['data']>['products'][number]
    >();

    for (const row of prodsRaw) {
      const { product, category, stock, location, upsellProduct } = row;

      let entry = productsMap.get(product.id);

      if (!entry) {
        entry = {
          ...product,
          categories: [],
          stock: [],
          upsellProducts: []
        };
        productsMap.set(product.id, entry);
      }

      if (category && !entry.categories.some((c) => c.id === category.id)) {
        entry.categories.push(category);
      }

      if (stock && location && !entry.stock.some((s) => s.id === stock.id)) {
        entry.stock.push({ ...stock, location });
      }

      if (upsellProduct && !entry.upsellProducts.some((p) => p.id === upsellProduct.id)) {
        entry.upsellProducts.push(upsellProduct);
      }
    }

    const prods = Array.from(productsMap.values());

    return NextResponse.json(
      {
        data: {
          products: prods,
          pagination: {
            total,
            totalPages,
            currentPage: page
          }
        },
        error: null
      },
      {
        status: 200
      }
    );
  } catch (error) {
    console.log('error getting products', error);

    return NextResponse.json(
      {
        data: null,
        error: 'Failed to get products'
      },
      {
        status: 500
      }
    );
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateProductResponse>> {
  const supabase = await createClient();
  const {
    data: { user: authUser }
  } = await supabase.auth.getUser();

  if (!authUser?.id) {
    return NextResponse.json(
      {
        data: null,
        error: 'Unauthorized'
      },
      { status: 401 }
    );
  }

  try {
    const user = (await db.select().from(users).where(eq(users.id, authUser.id)))[0];

    if (!user) {
      return NextResponse.json(
        {
          data: null,
          error: 'User not found'
        },
        { status: 404 }
      );
    }

    if (!user.active || !['super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json(
        {
          data: null,
          error: 'User is not active or does not have sufficient permissions'
        },
        { status: 403 }
      );
    }

    const rawBody = await request.json();

    const { data: body, success } = createProductSchema.safeParse(rawBody);

    console.log('body', body);

    if (!success) {
      return NextResponse.json(
        {
          data: null,
          error: 'Invalid request body'
        },
        { status: 400 }
      );
    }

    const productResult = await db
      .insert(products)
      .values({
        imgUrl: body.imageUrl,
        name: body.name,
        shortDescription: body.shortDescription,
        description: body.longDescription,
        price: body.price,
        createdBy: user.id
      })
      .returning();

    const product = productResult[0];

    // insert existing categories
    // insert existing categories
    if (body.categoryIds.length > 0) {
      await db
        .insert(productsCategories)
        .values(body.categoryIds.map((id) => ({ productId: product.id, categoryId: id })));
    }

    // insert new categories
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

        await db.insert(productsCategories).values(
          response.map(({ id }) => ({
            productId: product.id,
            categoryId: id
          }))
        );
      }
    }

    // upsells
    if (body.upsellIds.length > 0) {
      await db.insert(linkedProducts).values(
        body.upsellIds.map<typeof linkedProducts.$inferInsert>((id) => ({
          linkedId: id,
          productId: product.id
        }))
      );
    }

    return NextResponse.json<CreateProductResponse>(
      {
        data: product,
        error: null
      },
      { status: 200 }
    );
  } catch (error) {
    console.log('error creating product', error);

    return NextResponse.json(
      {
        data: null,
        error: 'Failed to create product'
      },
      { status: 500 }
    );
  }
}
