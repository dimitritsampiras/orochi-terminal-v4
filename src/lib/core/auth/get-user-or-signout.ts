import { profiles, userRole } from "../../../../drizzle/schema";
import { db } from "@/lib/clients/db";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/clients/supabase-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function getUserOrSignout(): Promise<typeof profiles.$inferSelect> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("user-id")?.value;

  console.log("user id from cookie", userId);

  if (!userId) {
    //
    return redirect("/auth/login");
  }

  const supabase = await createClient();
  const [dbUser] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);

  if (!dbUser) {
    console.log("[get-user-from-headers] user not found in db", userId);
    await supabase.auth.signOut();
    return redirect("/auth/login");
  }

  return dbUser;
}
