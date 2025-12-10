import { Header } from "@/components/nav/header";
import NavBar from "@/components/nav/nav-bar";
import { db } from "@/lib/clients/db";
import { cookies } from "next/headers";

import { redirect } from "next/navigation";
import { profiles } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserOrSignout();

  return (
    <div className="flex bg-zinc-50">
      <NavBar />
      <div className="w-full overflow-y-scroll">
        {/* TODO: Remove this and implement a proper header */}
        <Header user={user} />
        <main className="w-full px-4 pt-6 md:px-8 mb-24">{children}</main>
      </div>
    </div>
  );
}
