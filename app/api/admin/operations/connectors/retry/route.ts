import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { connectorJobOperationalReport, processDueConnectorSyncJobs } from "@/server/connectors/jobs";

export const dynamic = "force-dynamic";
async function requireAdmin(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { response: Response.json({ error: "Admin sign-in required." }, { status: 401, headers: { "cache-control": "no-store" } }) } as const;
  if (!isAdminUser(user.email, user.phone)) return { response: Response.json({ error: "Admin access denied." }, { status: 403, headers: { "cache-control": "no-store" } }) } as const;
  return { user } as const;
}
export async function GET(request: Request) {
  const auth = await requireAdmin(request); if ("response" in auth) return auth.response;
  return Response.json({ jobs: await connectorJobOperationalReport() }, { headers: { "cache-control": "no-store" } });
}
export async function POST(request: Request) {
  const auth = await requireAdmin(request); if ("response" in auth) return auth.response;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin admin operation blocked." }, { status: 403, headers: { "cache-control": "no-store" } });
  const result = await processDueConnectorSyncJobs();
  return Response.json({ result, jobs: await connectorJobOperationalReport() }, { headers: { "cache-control": "no-store" } });
}
