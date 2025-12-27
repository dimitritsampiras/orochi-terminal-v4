import { NextResponse } from "next/server";

export async function GET() {
  // const orders = await db.query.orders.findMany();
  return NextResponse.json({ data: "hello", error: null });
}
