import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { redirect } from "next/navigation";

export default async function AppPage() {
  const user = await getUserOrSignout();
  if (!user) {
    return redirect("/auth/login");
  }
  return redirect("/dashboard");
}
