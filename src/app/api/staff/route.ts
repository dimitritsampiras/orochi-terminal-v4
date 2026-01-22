import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/clients/db";
import { admin } from "@/lib/clients/supabase-admin";
import { profiles } from "@drizzle/schema";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { createStaffSchema } from "@/lib/schemas/staff-schema";
import type { CreateStaffResponse } from "@/lib/types/api";

// POST /api/staff - Create a new staff member
export async function POST(request: NextRequest): Promise<NextResponse<CreateStaffResponse>> {
  const user = await authorizeApiUser(["admin", "super_admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validationResult = createStaffSchema.safeParse(body);

  if (!validationResult.success) {
    console.log('invalid request', validationResult.error.issues);
    
    return NextResponse.json(
      { data: null, error: validationResult.error.issues[0]?.message || "Invalid request" },
      { status: 422 }
    );
  }

  const { username, email, password, role } = validationResult.data;

  // Only super_admin can create super_admin users
  if (role === "super_admin" && user.roleV4 !== "super_admin") {
    return NextResponse.json(
      { data: null, error: "Only super admins can create super admin users" },
      { status: 403 }
    );
  }

  // Check if username already exists
  const existingUsername = await db.query.profiles.findFirst({
    where: { username },
  });

  if (existingUsername) {
    return NextResponse.json({ data: null, error: "Username already exists" }, { status: 409 });
  }

  // Check if email already exists
  const existingEmail = await db.query.profiles.findFirst({
    where: { email },
  });

  if (existingEmail) {
    return NextResponse.json({ data: null, error: "Email already exists" }, { status: 409 });
  }

  // Create auth user with Supabase Admin
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authUser.user) {
    console.error("Failed to create auth user:", authError);
    return NextResponse.json(
      { data: null, error: authError?.message || "Failed to create user" },
      { status: 500 }
    );
  }

  // Create profile
  try {
    await db.insert(profiles).values({
      id: authUser.user.id,
      username,
      email,
      roleV4: role,
      role: "staff", // Deprecated field, keeping for compatibility
    });
  } catch (error) {
    // Rollback auth user if profile creation fails
    await admin.auth.admin.deleteUser(authUser.user.id);
    console.error("Failed to create profile:", error);
    return NextResponse.json({ data: null, error: "Failed to create user profile" }, { status: 500 });
  }

  return NextResponse.json({ data: "success", error: null }, { status: 201 });
}
