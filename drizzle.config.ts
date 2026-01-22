import { defineConfig } from "drizzle-kit";
export default defineConfig({
  out: "./drizzle",
  schema: "./drizzle/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || "",
  },
  schemaFilter: ["public"],
  introspect: {
    casing: "camel",
  },
});
