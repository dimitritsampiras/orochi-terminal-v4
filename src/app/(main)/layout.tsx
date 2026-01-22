import { Header } from "@/components/nav/header";
import NavBar from "@/components/nav/nav-bar";
import { getAuthenticatedUser } from "@/lib/core/auth/authorize-user";
import { getOperators } from "@/lib/core/auth/get-operators";
import { profiles } from "@drizzle/schema";


export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();

  const operators = await getOperators(user);
  

  return (
    <div className="flex bg-zinc-50">
      <NavBar user={user} operators={operators} />
      <div className="w-full overflow-y-scroll">
        <Header />
        <main className="w-full px-4 pt-6 md:px-8 mb-24">{children}</main>
      </div>
    </div>
  );
}
