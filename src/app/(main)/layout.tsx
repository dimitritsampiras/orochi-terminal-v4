import { Header } from "@/components/nav/header";
import NavBar from "@/components/nav/nav-bar";
import { getAuthenticatedUser } from "@/lib/core/auth/authorize-user";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();

  return (
    <div className="flex bg-zinc-50">
      <NavBar userRole={user?.roleV4} />
      <div className="w-full overflow-y-scroll">
        <Header />
        <main className="w-full px-4 pt-6 md:px-8 mb-24">{children}</main>
      </div>
    </div>
  );
}
