import { db } from "@/lib/clients/db";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { CreateStaffForm } from "@/components/forms/staff-forms/create-staff-form";
import { StaffTable } from "@/components/table/staff-table";

export default async function StaffPage() {
  const user = await authorizePageUser("staff");

  const staff = await db.query.profiles.findMany({
    orderBy: (profiles, { desc }) => [desc(profiles.createdAt)],
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="page-subtitle">Manage staff accounts</p>
        </div>

        <div className="mt-4 flex justify-end">
          <CreateStaffForm currentUserRole={user.roleV4} />
        </div>
      </div>

      <div className="mt-4">
        <StaffTable staff={staff} currentUserRole={user.roleV4} />
      </div>
    </div>
  );
}
