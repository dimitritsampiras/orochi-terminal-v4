import { createAdminApiClient } from "@shopify/admin-api-client";
import { env } from "../env";

const shopify = createAdminApiClient({
  storeDomain: "yamato-no-orochi.myshopify.com",
  apiVersion: env.SHOPIFY_API_VERSION,
  accessToken: env.SHOPIFY_ACCESS_TOKEN || "",
});

export default shopify;
