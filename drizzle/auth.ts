import { pgSchema, uuid, text } from "drizzle-orm/pg-core";

const auth = pgSchema("auth");

export const users = auth.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
});

// Export as usersInAuth to match your naming preference in relations.ts if needed
export const usersInAuth = users;
