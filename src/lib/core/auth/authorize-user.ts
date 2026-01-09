import { cache } from "react";
import { db } from "@/lib/clients/db";
import { createClient } from "@/lib/clients/supabase-server";
import { getRolesForResource, type Resource } from "@/lib/site";
import { profiles, userRoleV4 } from "@drizzle/schema";
import { redirect } from "next/navigation";

type Role = (typeof userRoleV4.enumValues)[number];
type User = typeof profiles.$inferSelect;

// ============================================================================
// SHARED - cached per request (deduplicates across layout + page)
// ============================================================================

export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const user = await db.query.profiles.findFirst({
    where: { id: authUser.id },
  });

  if (user === undefined) {
    await supabase.auth.signOut();
    return null;
  }

  // Sign out inactive users
  if (!user.isActive) {
    await supabase.auth.signOut();
    return null;
  }

  return user;
});

function isRoleAuthorized(userRole: Role, allowedRoles?: Role[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
}

// ============================================================================
// PAGE ROUTES: Built-in redirect, uses SITE resource permissions
// ============================================================================

/**
 * Authorize user for page routes.
 * - Always redirects to login on failure
 * - Uses SITE resource permissions
 *
 * @example
 * const user = await authorizePageUser("products");
 * const admin = await authorizePageUser("inventory");
 */
export async function authorizePageUser(resource: Resource): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/auth/login");
  }

  const allowedRoles = getRolesForResource(resource);

  if (!isRoleAuthorized(user.roleV4, allowedRoles)) {
    redirect("/auth/login");
  }

  return user;
}

// ============================================================================
// API ROUTES: No redirect, manual role specification
// ============================================================================

/**
 * Authorize user for API routes.
 * - Returns null on failure
 * - Manually specify roles
 *
 * @example
 * const user = await authorizeApiUser();
 * const admin = await authorizeApiUser(["admin", "super_admin"]);
 */
export async function authorizeApiUser(allowedRoles?: Role[]): Promise<User | null> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  if (!isRoleAuthorized(user.roleV4, allowedRoles)) {
    return null;
  }

  return user;
}
