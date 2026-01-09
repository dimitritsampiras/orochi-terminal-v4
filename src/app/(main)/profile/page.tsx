import { authorizePageUser } from "@/lib/core/auth/authorize-user";

export default async function ProfilePage() {
  await authorizePageUser("profile");
  return (
    <div>
      <h1 className="page-title">Profile</h1>
      <div className="page-subtitle">Manage your profile</div>
    </div>
  );
}
