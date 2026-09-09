import { z } from "zod";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { billingOperationalReport, reconcileRecentBillingWithProvider } from "@/server/billing-reconciliation";

export const dynamic = "force-dynamic";
const schema = z.object({ limit: z.number().int().min(1).max(100).default(40) });

async function requireAdmin(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { response: Response.json({ error: "Admin sign-in required." }, { status: 401, headers: { "cache-control": "no-store" } }) } as const;
  if (!isAdminUser(user.email, user.phone)) return { response: Response.json({ error: "Admin access denied." }, { status: 403, headers: { "cache-control": "no-store" } }) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if ("response" in auth) return auth.response;
  return Response.json({ report: await billingOperationalReport() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if ("response" in auth) return auth.response;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin admin operation blocked." }, { status: 403, headers: { "cache-control": "no-store" } });
  try {
    const input = schema.parse(await request.json());
    const result = await reconcileRecentBillingWithProvider({ limit: input.limit });
    return Response.json({ result, report: await billingOperationalReport() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid reconciliation limit." }, { status: 400, headers: { "cache-control": "no-store" } });
    return Response.json({ error: "Billing reconciliation could not complete. Retry later; no payment should be repeated because of this operator failure." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
