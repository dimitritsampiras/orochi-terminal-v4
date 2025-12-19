import { db } from "@/lib/clients/db";
import { authorizeUser } from "@/lib/core/auth/authorize-user";
import { GetBlanksResponse } from "@/lib/types/api";
import { NextResponse } from "next/server";

export const GET = async (): Promise<NextResponse<GetBlanksResponse>> => {
  const user = await authorizeUser(["superadmin", "admin", "va", "warehouse"]);

  if (!user) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const blanks = await db.query.blanks.findMany({
    with: {
      blankVariants: true,
    },
  });

  return NextResponse.json({ data: blanks, error: null });
};
