import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  DATABASE_URL: z.url(),
  SERVER_URL: z.url(),
  SHIPPO_TEST_KEY: z.string(),
  SHIPPO_KEY: z.string(),
  EASYPOST_TEST_KEY: z.string(),
  EASYPOST_KEY: z.string(),
  SHOPIFY_ACCESS_TOKEN: z.string(),
  SHOPIFY_API_VERSION: z.string(),
  SUPPRESS_LOGGING: z.coerce.boolean().default(false),
});

export const env = envSchema.parse(process.env);
