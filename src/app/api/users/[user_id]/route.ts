import { db } from "@/lib/clients/db";
import { editUserSchema } from "@/lib/schemas/user-schema";
import { type NextRequest, NextResponse } from "next/server";
import { users, usersLocations } from "../../../../../drizzle/schema";
import { eq, and, ne, or, count } from "drizzle-orm";
import type { EditUserResponse } from "@/lib/types/misc";
import { createClient } from "@/lib/clients/supabase-server";

/**
 *
 * Edit a new user
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ user_id: string }> }
): Promise<NextResponse<EditUserResponse>> {
	const supabase = await createClient();
	const {
		data: { user: authUser },
	} = await supabase.auth.getUser();

	if (!authUser?.id) {
		return NextResponse.json<EditUserResponse>(
			{ data: null, error: "Unauthorized" },
			{ status: 401 }
		);
	}

	const userId = (await params).user_id;

	if (!userId) {
		return NextResponse.json<EditUserResponse>(
			{ data: null, error: "User ID is required" },
			{ status: 400 }
		);
	}

	const rawBody = await request.json();
	const { success, data: body } = editUserSchema.safeParse(rawBody);

	if (!success) {
		return NextResponse.json<EditUserResponse>(
			{ data: null, error: "Invalid request" },
			{ status: 422 }
		);
	}

	try {
		const [dbAuthUser] = await db
			.select()
			.from(users)
			.where(eq(users.id, authUser.id));

		if (
			!authUser ||
			!dbAuthUser.active ||
			!["super_admin", "admin"].includes(dbAuthUser.role)
		) {
			return NextResponse.json<EditUserResponse>(
				{ data: null, error: "Not authorized" },
				{ status: 401 }
			);
		}

		const [targetUser] = await db
			.select()
			.from(users)
			.where(eq(users.id, userId));
		if (!targetUser) {
			return NextResponse.json<EditUserResponse>(
				{ data: null, error: "User not found" },
				{ status: 404 }
			);
		}

		if (body.role === "super_admin" && authUser.role !== "super_admin") {
			return NextResponse.json<EditUserResponse>(
				{
					data: null,
					error: "You are not authorized to assign super admin role",
				},
				{ status: 400 }
			);
		}

		if (body.active !== undefined) {
			// Prevent self-deactivation
			if (userId === dbAuthUser.id && !body.active) {
				return NextResponse.json<EditUserResponse>(
					{ data: null, error: "You cannot deactivate yourself" },
					{ status: 400 }
				);
			}

			// Super admin deactivation protection
			if (
				!body.active &&
				targetUser.role === "super_admin" &&
				authUser.role !== "super_admin"
			) {
				return NextResponse.json<EditUserResponse>(
					{
						data: null,
						error: "Only super admins can deactivate other super admins",
					},
					{ status: 403 }
				);
			}

			// Last admin protection
			if (
				!body.active &&
				(targetUser.role === "admin" || targetUser.role === "super_admin")
			) {
				const result = await db
					.select({ count: count() })
					.from(users)
					.where(
						and(
							eq(users.active, true),
							ne(users.id, userId),
							or(eq(users.role, "admin"), eq(users.role, "super_admin"))
						)
					);

				if (result[0]?.count === 0) {
					return NextResponse.json<EditUserResponse>(
						{ data: null, error: "Cannot deactivate the last active admin" },
						{ status: 400 }
					);
				}
			}
		}

		if (body.email && body.email !== targetUser.email) {
			const [existingUser] = await db
				.select()
				.from(users)
				.where(eq(users.email, body.email));
			if (existingUser) {
				return NextResponse.json<EditUserResponse>(
					{ data: null, error: "Email already exists" },
					{ status: 409 }
				);
			}
		}

		// Build update object - only include fields that were provided
		const updateData: Record<string, unknown> = {};

		if (body.firstName !== undefined) updateData.firstName = body.firstName;
		if (body.lastName !== undefined) updateData.lastName = body.lastName;
		if (body.email !== undefined) updateData.email = body.email;
		if (body.phone !== undefined) updateData.phone = body.phone;
		if (body.role !== undefined) updateData.role = body.role;
		if (body.active !== undefined) updateData.active = body.active;

		await db.update(users).set(updateData).where(eq(users.id, userId));

		if (body.location_ids !== undefined) {
			await db.delete(usersLocations).where(eq(usersLocations.userId, userId));

			if (body.location_ids.length > 0) {
				await db.insert(usersLocations).values(
					body.location_ids.map((locationId) => ({
						userId: userId,
						locationId: Number.parseInt(locationId),
					}))
				);
			}
		}

		return NextResponse.json<EditUserResponse>(
			{ data: "success", error: null },
			{ status: 200 }
		);
	} catch (e) {
		return NextResponse.json<EditUserResponse>(
			{ data: null, error: "Internal server error" },
			{ status: 500 }
		);
	}
}
