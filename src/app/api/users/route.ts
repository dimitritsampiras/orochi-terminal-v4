import { db } from "@/lib/clients/db";

import { createUserSchema } from "@/lib/schemas/user-schema";
import { type NextRequest, NextResponse } from "next/server";
import { locations, users, usersLocations } from "../../../../drizzle/schema";
import { and, desc, eq, inArray, not } from "drizzle-orm";

import type { CreateUserResponse, GetUsersResponse } from "@/lib/types/misc";

import { createClient } from "@/lib/clients/supabase-server";
import { admin } from "@/lib/clients/supabase-admin";

/**
 * fetch users
 */
export async function GET(
	request: NextRequest
): Promise<NextResponse<GetUsersResponse>> {
	const supabase = await createClient();
	const {
		data: { user: authUser },
	} = await supabase.auth.getUser();

	if (!authUser?.id) {
		return NextResponse.json<GetUsersResponse>(
			{ data: null, error: "Unauthorized" },
			{ status: 401 }
		);
	}

	const { searchParams } = request.nextUrl;
	const roles = searchParams.getAll("roles");
	const status = searchParams.get("status");
	const location_ids = searchParams.getAll("location_ids");

	try {
		const conditions = [not(eq(users.role, "customer"))];

		if (roles.length > 0) {
			conditions.push(
				inArray(
					users.role,
					users.role.enumValues.filter((role) => roles.includes(role))
				)
			);
		}

		if (status) {
			conditions.push(eq(users.active, status === "active"));
		}

		if (location_ids.length > 0) {
			conditions.push(
				inArray(usersLocations.locationId, location_ids.map(Number))
			);
		}

		const queryResults = await db
			.select({
				user: users,
				locations: locations,
			})
			.from(users)
			.leftJoin(usersLocations, eq(users.id, usersLocations.userId))
			.leftJoin(locations, eq(usersLocations.locationId, locations.id))
			.where(and(...conditions))
			.orderBy(desc(users.createdAt));

		// Group by user and collect locations
		const usersMap = new Map();

		queryResults.forEach((row) => {
			const userId = row.user.id;

			if (!usersMap.has(userId)) {
				usersMap.set(userId, {
					...row.user,
					locations: [],
				});
			}

			if (row.locations) {
				usersMap.get(userId).locations.push(row.locations);
			}
		});

		const userList = Array.from(usersMap.values());
		return NextResponse.json<GetUsersResponse>({ data: userList, error: null });
	} catch (error) {
		console.error(error);
		return NextResponse.json<GetUsersResponse>({
			data: null,
			error: "Failed to fetch users",
		});
	}
}

/**
 *
 * Create a new user
 */
export async function POST(
	request: NextRequest
): Promise<NextResponse<CreateUserResponse>> {
	const supabase = await createClient();
	const {
		data: { user: authUser },
	} = await supabase.auth.getUser();

	if (!authUser?.id) {
		return NextResponse.json(
			{ error: "Unauthorized", data: null },
			{ status: 401 }
		);
	}

	const body = await request.json();
	const {
		success,
		data,
		error: validationError,
	} = createUserSchema.safeParse(body);

	if (!success) {
		return NextResponse.json(
			{
				error: "Invalid request",
				data: null,
				details: validationError.errors,
			},
			{ status: 422 }
		);
	}

	// Get current user info
	const response = await db
		.select()
		.from(users)
		.where(eq(users.id, authUser.id))
		.limit(1);
	const currentUser = response[0];

	if (!currentUser) {
		return NextResponse.json(
			{ error: "User not found", data: null },
			{ status: 404 }
		);
	}

	// Authorization: Only super_admin and admin can create users
	if (!["super_admin", "admin"].includes(currentUser.role)) {
		return NextResponse.json(
			{ error: "You are not authorized to create users", data: null },
			{ status: 403 }
		);
	}

	// Only super_admin can create super_admin
	if (data.role === "super_admin" && currentUser.role !== "super_admin") {
		return NextResponse.json(
			{ error: "You are not authorized to create a super admin", data: null },
			{ status: 403 }
		);
	}

	try {
		// Handle admin/super_admin creation (email-based)
		if (["super_admin", "admin"].includes(data.role)) {
			if (!data.email) {
				return NextResponse.json(
					{ error: "Email is required for admin roles", data: null },
					{ status: 400 }
				);
			}

			// const password = autoGeneratePassword();
			const password = "testing123";
			const {
				data: { user: newAuthUser },
				error: authUserError,
			} = await admin.auth.admin.createUser({
				email: data.email,
				password: password,
				email_confirm: true,
			});

			if (authUserError || !newAuthUser) {
				console.log("[create user] error creating auth user", authUserError);
				return NextResponse.json(
					{ error: "Failed to create auth user", data: null },
					{ status: 400 }
				);
			}

			const newUserResponse = await db
				.insert(users)
				.values({
					id: newAuthUser.id, // Link to Supabase auth user
					firstName: data.firstName,
					lastName: data.lastName,
					email: data.email,
					role: data.role,
				})
				.returning();

			const newUser = newUserResponse[0];
			return NextResponse.json({ data: newUser, error: null }, { status: 201 });
		}

		// Handle nurse/delivery creation (phone-based)
		if (["nurse", "delivery"].includes(data.role)) {
			if (!data.phone) {
				return NextResponse.json(
					{ error: "Phone is required for nurse/delivery roles", data: null },
					{ status: 400 }
				);
			}

			if (!data.location_ids || data.location_ids.length === 0) {
				return NextResponse.json(
					{
						error: "At least one location is required for nurse/delivery roles",
						data: null,
					},
					{ status: 400 }
				);
			}

			const {
				data: { user: newAuthUser },
				error: authUserError,
			} = await admin.auth.admin.createUser({
				phone: data.phone,
				phone_confirm: true,
			});

			if (authUserError || !newAuthUser) {
				console.log("[create user] error creating auth user", authUserError);
				return NextResponse.json(
					{
						error: `Failed to create user. ${authUserError?.message}`,
						data: null,
					},
					{ status: 400 }
				);
			}

			// Create user in database
			const newUserResponse = await db
				.insert(users)
				.values({
					id: newAuthUser.id, // Link to Supabase auth user
					firstName: data.firstName,
					lastName: data.lastName,
					phone: data.phone, // Store in phone field, not email
					role: data.role,
				})
				.returning();

			const newUser = newUserResponse[0];

			// Associate user with locations
			if (newUser && data.location_ids) {
				await db.insert(usersLocations).values(
					data.location_ids.map((locationId) => ({
						userId: newUser.id,
						locationId: Number.parseInt(locationId),
					}))
				);
			}

			return NextResponse.json({ data: newUser, error: null }, { status: 201 });
		}

		return NextResponse.json(
			{
				error: "Invalid role specified",
				data: null,
			},
			{ status: 400 }
		);
	} catch (error) {
		console.error("[create user] error:", error);
		return NextResponse.json(
			{
				error: "Failed to create user",
				data: null,
			},
			{ status: 500 }
		);
	}
}
