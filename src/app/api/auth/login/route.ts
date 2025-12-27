import { loginSchema } from "@/lib/schemas/auth-schema";
import { createClient } from "@/lib/clients/supabase-server";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/clients/db";
import { profiles, userRole } from "../../../../../drizzle/schema";
import { eq } from "drizzle-orm";

import { z } from "zod";
import { LoginResponse } from "@/lib/types/api";

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  const body = await request.json();

  const validationResult = loginSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json({ data: null, error: "Invalid request" }, { status: 422 });
  }

  const { identifier, password } = validationResult.data;
  let email = identifier;

  // Check if identifier is an email
  const isEmail = z.string().email().safeParse(identifier).success;

  if (!isEmail) {
    // Assume it's a username and try to find the email
    const [user] = await db
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.username, identifier));

    if (!user) {
      // Username not found
      return NextResponse.json({ data: null, error: "Invalid credentials" }, { status: 401 });
    }
    email = user.email;
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ data: null, error: "Invalid credentials" }, { status: 401 });
  }

  const [user] = await db.select().from(profiles).where(eq(profiles.id, data.user.id));

  if (!user) {
    return NextResponse.json({ data: null, error: "User not found" }, { status: 404 });
  }

  if (!(["superadmin", "admin"] as (typeof userRole.enumValues)[number][]).includes(user.role)) {
    await supabase.auth.signOut();
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: "success", error: null }, { status: 200 });
}
