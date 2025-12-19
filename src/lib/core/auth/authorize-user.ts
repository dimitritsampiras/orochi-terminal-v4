import { db } from "@/lib/clients/db";
import { createClient } from "@/lib/clients/supabase-server";
import { userRole } from "@drizzle/schema";

type AuthorizeUserOptions = {
  authorizedRoles: (typeof userRole.enumValues)[number][];
};

export const authorizeUser = async (
  authorizedRoles: (typeof userRole.enumValues)[number][] = ["superadmin", "admin", "warehouse", "va"]
) => {
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

  if (user === undefined || !authorizedRoles.includes(user.role)) {
    return null;
  }

  return user;
};
