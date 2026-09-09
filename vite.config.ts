import vinext from "vinext";
import {buildProvenance} from "./scripts/build-provenance.mjs";
import { defineConfig } from "vite";

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. Secrets belong in ignored
  // local environment files or Cloudflare Worker secrets, never source control.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {__SELLERHISAB_BUILD__:JSON.stringify(buildProvenance())},
    server: {
      host: "0.0.0.0",
    },
    plugins: [
      vinext(),
      cloudflare({
        // Wrangler is the single source of truth for runtime bindings.
        configPath: process.env.SELLERHISAB_TEST === "1" ? "./wrangler.test.jsonc" : "./wrangler.jsonc",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
      }),
    ],
  };
});
