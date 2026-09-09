import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) {
    console.error(`SEO source check failed: ${message}`);
    process.exit(1);
  }
};

const requiredFiles = [
  "app/robots.ts",
  "app/sitemap.ts",
  "core/seo.ts",
  "core/seo-hubs.ts",
  "core/indexnow.ts",
  "server/indexnow.ts",
  "app/about/page.tsx",
  "app/editorial-policy/page.tsx",
  "app/corrections-policy/page.tsx",
  "app/authors/sellerhisab-research/page.tsx",
  "app/marketplaces/page.tsx",
  "app/marketplaces/[marketplace]/page.tsx",
  "app/guides/page.tsx",
  "app/guides/[slug]/page.tsx",
  "docs/seo/SEO_IMPLEMENTATION.md",
  "docs/seo/EXTERNAL_SETUP_CHECKLIST.md",
  "docs/seo/CONTENT_MAP.md",
];
for (const path of requiredFiles) assert(existsSync(join(root, path)), `missing ${path}`);

const robots = read("app/robots.ts");
assert(robots.includes("OAI-SearchBot"), "OAI-SearchBot is not explicitly allowed");
assert(robots.includes("PRIVATE_SEARCH_PREFIXES"), "robots does not use the private-route policy");

const seo = read("core/seo.ts");
assert(seo.includes('"/app"') && seo.includes('"/admin"'), "private app/admin prefixes missing");
assert(seo.includes('"/api/account"') && seo.includes('"/api/auth"'), "private API prefixes missing");
assert(!/^[^\n]*"\/api"[^\n]*$/m.test(seo), "generic /api disallow would block public blog media crawling");

const sitemap = read("app/sitemap.ts");
assert(sitemap.includes("PUBLIC_STATIC_PATHS"), "sitemap is not sourced from public canonical paths");
assert(sitemap.includes("post.updatedAt || post.publishedAt || post.createdAt"), "blog sitemap freshness is not evidence-backed");
assert(!sitemap.includes("lastModified: new Date(),"), "static URLs are being falsely refreshed on every request");

const layout = read("app/layout.tsx");
assert(
  layout.includes("getPublicSeoSettings") &&
  layout.includes("seo.discovery.discoverLargeImages") &&
  /["']max-image-preview["']\s*:\s*seo\.discovery\.discoverLargeImages\s*\?\s*["']large["']\s*:\s*["']standard["']/.test(layout),
  "admin-managed max-image-preview metadata missing",
);

const worker = read("worker/index.ts");
assert(worker.includes('"x-robots-tag"'), "private response X-Robots-Tag protection missing");
assert(worker.includes("x-request-id") && worker.includes("x-sellerhisab-release"), "launch-hardening request/release headers were lost");
assert(worker.includes("scheduled(controller"), "launch-hardening scheduled jobs were lost");

const media = read("app/api/admin/blog/media/route.ts");
assert(media.includes("kind.width < 1200"), "Discover hero minimum width guard missing");
assert(media.includes("ratio < 1.6 || ratio > 1.9"), "Discover hero landscape ratio guard missing");

const keyModule = read("core/indexnow.ts");
const keyMatch = keyModule.match(/INDEXNOW_KEY = "([a-f0-9]{32})"/);
assert(keyMatch, "IndexNow key is missing or invalid");
const key = keyMatch[1];
const keyPath = join(root, "public", `${key}.txt`);
assert(existsSync(keyPath), "IndexNow public key file missing");
assert(readFileSync(keyPath, "utf8").trim() === key, "IndexNow public key file content mismatch");

const calculator = read("core/seo-pages.ts");
for (const marker of ["directAnswer:", "formula:", "example:", "faqs:", "related:"]) {
  assert(calculator.includes(marker), `calculator AEO field missing: ${marker}`);
}

const homepage = read("app/page.tsx");
assert(homepage.includes('"@type": "Organization"'), "Organization schema missing");
assert(homepage.includes('"@type": "WebSite"'), "WebSite schema missing");
assert(homepage.includes('"@type": "SoftwareApplication"'), "SoftwareApplication schema missing");
assert(!homepage.includes("aggregateRating"), "fake/unverified aggregate rating schema must not be present");

const migrations = readdirSync(join(root, "drizzle")).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
assert(migrations.includes("0018_bilingual_blog.sql"), "Applied bilingual migration is missing");
assert(new Set(migrations.map(name=>name.slice(0,4))).size === migrations.length, "Duplicate migration sequence");

console.log("SellerHisab SEO source check passed.");
console.log(`IndexNow key: ${key}`);
console.log(`Migration ceiling: ${migrations.at(-1)}`);
