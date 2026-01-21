import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "*.lock",
      "pnpm-lock.yaml",
      "package-lock.json",
      "yarn.lock",
      ".DS_Store",
      "*.log",
      ".env",
      ".env.local",
      ".env.*.local",
      "drizzle/**",
      "*.sql",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    rules: {
      // Add any custom rules here
    },
  },
];

export default eslintConfig;

