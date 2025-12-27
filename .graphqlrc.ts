import { ApiType, shopifyApiProject } from "@shopify/api-codegen-preset";
import dotenv from "dotenv";

dotenv.config();

const shopifyApiVersion = process.env.SHOPIFY_API_VERSION;
if (!shopifyApiVersion) {
  throw new Error("SHOPIFY_API_VERSION is not set");
}

export default {
  schema: "https://shopify.dev/admin-graphql-direct-proxy",
  documents: ["*.ts", "!node_modules"],
  projects: {
    default: shopifyApiProject({
      apiType: ApiType.Admin,
      apiVersion: shopifyApiVersion,
      outputDir: "./src/lib/types",
    }),
  },
};
