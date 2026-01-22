import { db } from "@/lib/clients/db";
import { profiles } from "@drizzle/schema";
import { headers } from "next/headers";
import { cache } from "react";

type User = typeof profiles.$inferSelect;
export const getOperators = cache(async (user: User | null): Promise<User[]> => {
  // Only fetch operators if we are the warehouse generic account
  let operators: typeof profiles.$inferSelect[] = [];

  if (user?.roleV4 === "operator") {
    operators = await db.query.profiles.findMany({
      where: {
        isActive: true,
        // Exclude the generic account itself so it's not in the list
        id: { ne: user.id },
        // Only show staff/admins
        roleV4: { in: ["warehouse_staff", "admin", "super_admin"] }
      }
    });
  }

  return operators;
});

export const getOperator = async (user: User) => {
  const headerList = await headers();
  const operatorId = headerList.get("x-operator-id");

  if (operatorId) {
    // Fetch the operator profile
    const operator = await db.query.profiles.findFirst({
      where: { id: operatorId, isActive: true }
    });
    if (operator) {
      return operator;
    }
  }
  return null
}