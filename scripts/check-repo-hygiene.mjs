import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const ignoredDirectories = new Set(["node_modules", ".playwright-browsers", ".git", ".next", "dist", ".wrangler", "coverage", "playwright-report", "test-results"]);
const forbiddenRootNames = new Set([
  "_patch_backups",
  "wrangler.before-blog-preview.jsonc",
  "APPLY_PROJECT_UPDATE_V1.4.md",
  "APPLY_UI_UPDATE_V1.1.md",
  "APPLY_UI_UPDATE_V1.2.md",
  "APPLY_UI_UPDATE_V1.3.md",
  "DEVELOPER_HANDOFF.md",
]);
const violations = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const full = join(directory, entry.name);
    const rel = relative(root, full).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (entry.name.startsWith("_backup_before_") || entry.name === "_patch_backups") {
        violations.push(rel + "/");
        continue;
      }
      await walk(full);
      continue;
    }

    const rootLevel = !rel.includes("/");
    if (
      entry.name.endsWith(".bak") ||
      entry.name.includes(".before-") ||

      (rootLevel && forbiddenRootNames.has(entry.name)) ||
      (rootLevel && /^APPLY_.*\.md$/i.test(entry.name))
    ) {
      violations.push(rel);
    }
  }
}

await walk(root);

if (violations.length) {
  console.error("Repository hygiene check failed. Move/delete these local artifacts:");
  for (const item of violations.sort()) console.error(` - ${item}`);
  process.exit(1);
}

console.log("Repository hygiene check passed.");



