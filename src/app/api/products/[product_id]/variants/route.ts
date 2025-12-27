import { NextResponse } from "next/server";

export async function GET() {
  // const variants = await db.query.productVariants.findMany();
  return NextResponse.json({ data: "hello", error: null });
}