import { requestHasSameOrigin } from "@/server/admin";
import { clearSessionCookie, revokeSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin request blocked." }, { status: 403 });
  await revokeSession(request);
  return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
}
