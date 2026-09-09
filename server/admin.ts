import { appEnvironment, runtimeEnv } from "./runtime";

export function parseAdminEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function parseAdminPhones(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((phone) => phone.replace(/\D/g, ""))
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = parseAdminEmails(runtimeEnv().ADMIN_EMAILS);
  return allowed.includes(email.trim().toLowerCase());
}

export function isAdminPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const allowed = parseAdminPhones(runtimeEnv().ADMIN_PHONES);
  return allowed.includes(phone.replace(/\D/g, ""));
}

export function isAdminUser(email: string | null | undefined, phone: string | null | undefined): boolean {
  if (appEnvironment() === "local" && parseAdminEmails(runtimeEnv().ADMIN_EMAILS).length === 0 && parseAdminPhones(runtimeEnv().ADMIN_PHONES).length === 0) return true;
  return isAdminEmail(email) || isAdminPhone(phone);
}

export function requestHasSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return false;
  const origin = request.headers.get("origin");
  if (origin) return origin === new URL(request.url).origin;
  // Non-browser provider callbacks have no Fetch Metadata. Cookie mutations
  // must prove same-origin even when Origin has been stripped.
  return !request.headers.has("cookie") || site === "same-origin";
}
