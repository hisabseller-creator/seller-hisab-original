import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("account lifecycle export schema contract", () => {
  it("reads the benchmark opt-in column that exists in migration 0014", () => {
    const lifecycleSource = readFileSync(join(process.cwd(), "server/account-lifecycle.ts"), "utf8");
    const benchmarkMigration = readFileSync(
      join(process.cwd(), "drizzle/0014_governed_ask_benchmarks.sql"),
      "utf8",
    );

    expect(benchmarkMigration).toContain("`contribute_enabled` integer DEFAULT 0 NOT NULL");
    expect(lifecycleSource).toContain(
      "SELECT contribute_enabled AS contributeEnabled, updated_at AS updatedAt FROM benchmark_preferences WHERE tenant_id = ?1 LIMIT 1",
    );
    expect(lifecycleSource).not.toContain(
      "SELECT enabled, updated_at AS updatedAt FROM benchmark_preferences WHERE tenant_id = ?1 LIMIT 1",
    );
  });
});
