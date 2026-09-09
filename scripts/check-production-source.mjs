import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const runtimeRoots = ["app", "components", "core", "server", "worker"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".jsonc"]);
const forbidden = [
  { needle: "PAYMENT_MODE", reason: "payment simulator/runtime mode switch" },
  { needle: "payment-simulator", reason: "payment simulator token path" },
  { needle: "subscription-simulator", reason: "subscription simulator token path" },
  { needle: "simulatorToken", reason: "simulator proof field" },
  { needle: "developmentOtp", reason: "development OTP exposure path" },
  { needle: "Preview OTP:", reason: "development OTP UI" },
  { needle: 'href="/demo"', reason: "public demo link" },
];

const problems = [];

for (const base of runtimeRoots) {
  await walk(join(root, base));
}

const wrangler = await readFile(join(root, "wrangler.jsonc"), "utf8");
if (!wrangler.includes('"APP_ENV": "production"')) problems.push("wrangler.jsonc: APP_ENV must be production");
if (!wrangler.includes('"pattern": "sellerhisab.com"')) problems.push("wrangler.jsonc: sellerhisab.com custom domain is missing");
if (!wrangler.includes('"pattern": "www.sellerhisab.com"')) problems.push("wrangler.jsonc: www.sellerhisab.com custom domain is missing");

const siteUrl = await readFile(join(root, "core", "site-url.ts"), "utf8");
if (!siteUrl.includes('https://sellerhisab.com')) problems.push("core/site-url.ts: canonical production domain is not sellerhisab.com");

if (problems.length) {
  console.error("Production source check failed:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

console.log("Production source check passed.");

async function walk(path) {
  let info;
  try {
    info = await stat(path);
  } catch {
    return;
  }

  if (info.isDirectory()) {
    for (const name of await readdir(path)) await walk(join(path, name));
    return;
  }

  if (!sourceExtensions.has(extension(path))) return;
  const text = await readFile(path, "utf8");
  for (const rule of forbidden) {
    if (text.includes(rule.needle)) {
      problems.push(`${relative(root, path)}: contains ${rule.reason}`);
    }
  }
}

function extension(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}
