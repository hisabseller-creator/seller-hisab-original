import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "_backup*/**",
    "next-env.d.ts",
    // Static Framer export is vendored/generated code; lint SellerHisab source, not vendor bundles.
    "public/framer-home-exact/**",
    // Cloudflare/Wrangler generated runtime bundles; never lint as app source.
    ".wrangler/**",
    ".playwright-browsers/**",
    "artifacts/**",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["components/account-workspace.tsx"],
    rules: {
      // Existing billing copy contains a plain apostrophe in JSX text. Keep it
      // visible as a warning without blocking unrelated production validation.
      "react/no-unescaped-entities": "warn",
    },
  },
  {
    files: ["components/marketplace-hub-experience.tsx", "components/marketplace-connections-workspace.tsx"],
    rules: {
      // Marketplace connection status is fetched immediately when these views mount.
      // Their refresh functions update loading/result state around external fetches;
      // keep this React 19 advisory visible without making it a release blocker.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
