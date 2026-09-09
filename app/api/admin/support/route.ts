import { z } from "zod";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { listSupportRequests, updateSupportRequest } from "@/server/support";

export const dynamic = "force-dynamic";
const updateSchema = z.object({
  id: z.string().min(4).max(120),
  status: z.enum(["open", "in_progress", "waiting_customer", "resolved"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedTo: z.string().trim().max(120).nullable().optional(),
  resolutionNote: z.string().trim().max(2000).nullable().optional(),
});

async function adminUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { response: Response.json({ error: "Admin sign-in required." }, { status: 401, headers: { "cache-control": "no-store" } }) } as const;
  if (!isAdminUser(user.email, user.phone)) return { response: Response.json({ error: "Admin access denied." }, { status: 403, headers: { "cache-control": "no-store" } }) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await adminUser(request);
  if ("response" in auth) return auth.response;
  return Response.json({ requests: await listSupportRequests() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await adminUser(request);
  if ("response" in auth) return auth.response;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin admin request blocked." }, { status: 403, headers: { "cache-control": "no-store" } });
  try {
    const input = updateSchema.parse(await request.json());
    await updateSupportRequest({ ...input, actorUserId: auth.user.id });
    return Response.json({ ok: true, requests: await listSupportRequests() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid support update." }, { status: 400, headers: { "cache-control": "no-store" } });
    return Response.json({ error: error instanceof Error ? error.message : "Support request could not be updated." }, { status: 409, headers: { "cache-control": "no-store" } });
  }
}
