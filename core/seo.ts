import { SITE_URL } from "./site-url";

export const SITE_NAME = "SellerHisab";
export const BRAND_DESCRIPTION =
  "SellerHisab is an independent tool for Indian online sellers. It helps sellers understand how much they actually earn after product cost, marketplace charges, returns or RTO, ads and settlements, using supported marketplace reports.";

export const SEO_REVIEWED_AT = "2026-09-04";
export const RESEARCH_AUTHOR_PATH = "/authors/sellerhisab-research";
export const RESEARCH_AUTHOR_NAME = "SellerHisab Research Team";

export const PRIVATE_SEARCH_PREFIXES = [
  "/app",
  "/admin",
  "/api/account",
  "/api/admin",
  "/api/auth",
  "/api/billing",
  "/api/payments",
  "/api/entitlements",
  "/api/config",
  "/api/contact",
  "/api/health",
] as const;

export const PUBLIC_STATIC_PATHS = [
  "",
  "/analyze",
  "/calculators",
  "/pricing",
  "/methodology",
  "/help",
  "/contact",
  "/blog",
  "/news",
  "/videos",
  "/about",
  "/guides",
  "/marketplaces",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/editorial-policy",
  "/corrections-policy",
  RESEARCH_AUTHOR_PATH,
] as const;

export function absoluteUrl(path = "") {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${SITE_URL}${normalized}`;
}

export function isPrivateSearchPath(pathname: string) {
  return PRIVATE_SEARCH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
