import { InventoryRequirementsController } from "@/components/controllers/inventory-requirements-controller";
import { BackButton } from "@/components/nav/back-button";
import { db } from "@/lib/clients/db";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";

export default async function RequirementsPage() {
  await authorizePageUser("inventory");

  const blanks = await db.query.blanks.findMany({
    with: {
      blankVariants: true,
    },
    orderBy: { blankCompany: "asc" },
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <BackButton fallbackHref="/inventory" />
        <h1 className="page-title">Inventory Requirements</h1>
      </div>
      <InventoryRequirementsController blanks={blanks} />
    </div>
  );
}
