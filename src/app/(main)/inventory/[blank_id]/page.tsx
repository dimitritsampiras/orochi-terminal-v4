import { db } from "@/lib/clients/db";
import { getUserOrSignout } from "@/lib/core/auth/get-user-or-signout";
import { IdCopyBadge } from "@/components/badges/id-copy-badge";
import { BlankVariantsTable } from "@/components/cards/blank-variants";
import { BlankInfoCard } from "@/components/cards/blank-info";
import { Icon } from "@iconify/react";
import dayjs from "dayjs";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function BlankInventoryPage({ params }: { params: Promise<{ blank_id: string }> }) {
  await getUserOrSignout();

  const { blank_id } = await params;

  const blank = await db.query.blanks.findFirst({
    where: {
      id: blank_id,
    },
    with: {
      blankVariants: true,
    },
  });

  if (!blank) {
    throw new Error("Blank not found");
  }

  return (
    <div>
      <h1 className="page-title capitalize">
        {blank.blankCompany} {blank.blankName}
      </h1>
      <div className="flex items-center gap-2 mt-2">
        <IdCopyBadge id={blank.id} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon icon="ph:calendar-blank" />
          Created {dayjs(blank.createdAt).format("MMMM DD, YYYY")}
        </div>
      </div>

      <div className="mb-24 mt-6 grid-cols-[2fr_1fr] gap-4 md:grid">
        <div className="flex flex-col gap-4">
          <BlankVariantsTable blankId={blank.id} variants={blank.blankVariants} />
        </div>
        <div className="flex flex-col gap-4 sm:mt-0 mt-4">
          <BlankInfoCard blank={blank} />
        </div>
      </div>
    </div>
  );
}
