import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { ProfileController } from "@/components/controllers/profile-controller";

export default async function ProfilePage() {
  await authorizePageUser("profile");
  return (
    <div>
      <h1 className="page-title">Profile</h1>
      <div className="page-subtitle">Manage your profile</div>
      <div className="mt-6 space-y-8">
        <ProfileController />
        <SignOutButton />
      </div>
    </div>
  );
}
