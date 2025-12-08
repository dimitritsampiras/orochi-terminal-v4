import { db } from '@/lib/clients/db';

import { type NextRequest, NextResponse } from 'next/server';
import {
  users,
  orders,
  ordersServices,
  ordersProducts,
  services,
  products,
  addresses,
  cities
} from '../../../../drizzle/schema';
import { and, count, desc, eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const paymentStatus = searchParams.get('payment_status');
  const paymentMethod = searchParams.get('payment_method');
  const customerId = searchParams.get('customer_id');
  const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : 10;
  const page = searchParams.get('page') ? Number(searchParams.get('page')) - 1 : 0;

  const conditions = [];

  if (paymentStatus) {
    conditions.push(eq(orders.paid, paymentStatus === 'paid'));
  }

  if (paymentMethod) {
    conditions.push(eq(orders.paymentMethod, paymentMethod as 'cash' | 'online' | 'qr'));
  }

  if (customerId) {
    conditions.push(eq(orders.customerId, customerId));
  }

  const ordersData = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      customerId: orders.customerId,
      paid: orders.paid,
      paymentMethod: orders.paymentMethod,
      createdAt: orders.createdAt,
      bookingDate: orders.bookingDate,
      deliveryType: orders.deliveryType,
      customer: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone
      },
      address: {
        id: addresses.id,
        address: addresses.address,
        city: cities.name,
        postalCode: addresses.postalCode
      },
      services: sql`COALESCE(json_agg(
					CASE WHEN ${services.id} IS NOT NULL THEN json_build_object(
						'id', ${services.id},
						'name', ${services.name},
						'price', ${services.price},
						'qty', ${ordersServices.qty},
						'imgUrl', ${services.imgUrl}
					) END
				), '[]')`.as('services'),
      products: sql`COALESCE(json_agg(
					CASE WHEN ${products.id} IS NOT NULL THEN json_build_object(
						'id', ${products.id},
						'name', ${products.name},
						'price', ${products.price},
						'qty', ${ordersProducts.qty},
						'imgUrl', ${products.imgUrl}
					) END
				), '[]')`.as('products')
    })
    .from(orders)
    .leftJoin(users, eq(orders.customerId, users.id))
    .leftJoin(ordersServices, eq(orders.id, ordersServices.orderId))
    .leftJoin(services, eq(ordersServices.serviceId, services.id))
    .leftJoin(ordersProducts, eq(orders.id, ordersProducts.orderId))
    .leftJoin(products, eq(ordersProducts.productId, products.id))
    .leftJoin(addresses, eq(orders.addressId, addresses.id))
    .leftJoin(cities, eq(addresses.city, cities.id))
    .where(and(...conditions))
    .groupBy(
      orders.id,
      users.id,
      users.firstName,
      users.lastName,
      users.phone,
      addresses.id,
      addresses.address,
      cities.name,
      addresses.postalCode
    )
    .orderBy(desc(orders.createdAt))
    .limit(perPage)
    .offset(page * perPage);

  const countData = await db
    .select({ count: count() })
    .from(orders)
    .where(and(...conditions));

  console.log('ordersData[0].deliveryType', ordersData[0].deliveryType);

  return NextResponse.json({
    orders: ordersData,
    count: countData[0].count
  });
}
