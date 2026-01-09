import { db } from "@/lib/clients/db";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { BlanksInventoryTable } from "@/components/table/blanks-inventory-table";
import { buttonVariants } from "@/components/ui/button";
import { CreateBlankForm } from "@/components/forms/blank-forms/create-blank-form";
import Link from "next/link";
import { authorizePageUser } from "@/lib/core/auth/authorize-user";

export default async function InventoryPage() {
  await authorizePageUser("inventory");

  const blanks = await db.query.blanks.findMany({
    with: {
      blankVariants: true,
    },
    orderBy: { blankCompany: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">View and manage blank inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/requirements" className={buttonVariants({ variant: "outline" })}>
            Requirements
          </Link>
          <CreateBlankForm />
        </div>
      </div>

      <BlanksInventoryTable blanks={blanks} />
    </div>
  );
}
