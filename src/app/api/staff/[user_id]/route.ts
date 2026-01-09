import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/clients/db";
import { admin } from "@/lib/clients/supabase-admin";
import { profiles } from "@drizzle/schema";
import { eq } from "drizzle-orm";
import { authorizeApiUser } from "@/lib/core/auth/authorize-user";
import { editStaffSchema } from "@/lib/schemas/staff-schema";
import type { EditStaffResponse, DeleteStaffResponse } from "@/lib/types/api";

type RouteParams = { params: Promise<{ user_id: string }> };

// PATCH /api/staff/[user_id] - Edit a staff member
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<EditStaffResponse>> {
  const user = await authorizeApiUser(["admin", "super_admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { user_id } = await params;
  const body = await request.json();
  const validationResult = editStaffSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json(
      { data: null, error: validationResult.error.issues[0]?.message || "Invalid request" },
      { status: 422 }
    );
  }

  const { username, email, password, role, isActive } = validationResult.data;

  // Get target user
  const targetUser = await db.query.profiles.findFirst({
    where: { id: user_id },
  });

  if (!targetUser) {
    return NextResponse.json({ data: null, error: "User not found" }, { status: 404 });
  }

  // Only super_admin can edit super_admin users
  if (targetUser.roleV4 === "super_admin" && user.roleV4 !== "super_admin") {
    return NextResponse.json(
      { data: null, error: "Only super admins can edit super admin users" },
      { status: 403 }
    );
  }

  // Only super_admin can promote to super_admin
  if (role === "super_admin" && user.roleV4 !== "super_admin") {
    return NextResponse.json(
      { data: null, error: "Only super admins can promote to super admin" },
      { status: 403 }
    );
  }

  // Check username uniqueness (if changing)
  if (username && username !== targetUser.username) {
    const existingUsername = await db.query.profiles.findFirst({
      where: { username },
    });
    if (existingUsername) {
      return NextResponse.json({ data: null, error: "Username already exists" }, { status: 409 });
    }
  }

  // Check email uniqueness (if changing)
  if (email && email !== targetUser.email) {
    const existingEmail = await db.query.profiles.findFirst({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json({ data: null, error: "Email already exists" }, { status: 409 });
    }
  }

  // Update auth user if email or password changed
  if (email || password) {
    const updateData: { email?: string; password?: string } = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    const { error: authError } = await admin.auth.admin.updateUserById(user_id, updateData);

    if (authError) {
      console.error("Failed to update auth user:", authError);
      return NextResponse.json(
        { data: null, error: authError.message || "Failed to update user" },
        { status: 500 }
      );
    }
  }

  // Update profile
  const updateData: Partial<typeof profiles.$inferInsert> = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (role) updateData.roleV4 = role;
  if (isActive !== undefined) updateData.isActive = isActive;

  if (Object.keys(updateData).length > 0) {
    await db.update(profiles).set(updateData).where(eq(profiles.id, user_id));
  }

  return NextResponse.json({ data: "success", error: null });
}

// DELETE /api/staff/[user_id] - Delete a staff member (super_admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<DeleteStaffResponse>> {
  const user = await authorizeApiUser(["super_admin"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Only super admins can delete users" }, { status: 401 });
  }

  const { user_id } = await params;

  // Get target user
  const targetUser = await db.query.profiles.findFirst({
    where: { id: user_id },
  });

  if (!targetUser) {
    return NextResponse.json({ data: null, error: "User not found" }, { status: 404 });
  }

  // Can't delete yourself
  if (user.id === user_id) {
    return NextResponse.json({ data: null, error: "You cannot delete yourself" }, { status: 403 });
  }

  // Delete from Supabase Auth (cascades to profiles due to foreign key)
  const { error: authError } = await admin.auth.admin.deleteUser(user_id);

  if (authError) {
    console.error("Failed to delete auth user:", authError);
    return NextResponse.json(
      { data: null, error: authError.message || "Failed to delete user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: "success", error: null });
}
