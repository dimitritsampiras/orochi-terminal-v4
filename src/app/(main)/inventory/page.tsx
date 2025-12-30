import { db } from "@/lib/clients/db";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { BlanksInventoryTable } from "@/components/table/blanks-inventory-table";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function InventoryPage() {
  await getUserOrSignout();

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
        <div>
          <Link href="/inventory/requirements" className={buttonVariants({ variant: "outline" })}>Requirements</Link>
        </div>
      </div>

      <BlanksInventoryTable blanks={blanks} />
    </div>
  );
}
