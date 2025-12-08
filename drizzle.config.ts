import { defineConfig } from "drizzle-kit";
export default defineConfig({
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || "",
  },
  schemaFilter: ["public"],
  introspect: {
    casing: "camel",
  },
});
