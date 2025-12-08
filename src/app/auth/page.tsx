import { redirect } from "next/navigation";

export default async function AuthPage() {
	await redirect("/auth/login");

	return <div>AuthPage</div>;
}
