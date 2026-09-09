import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { clearSessionCookie, getSessionUser } from "@/server/auth";
import { AccountDeletionBlockedError, buildAccountExport, deleteAccountData } from "@/server/account-lifecycle";
import { enforceIpRateLimit, enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
const deleteSchema = z.object({ confirmation: z.literal("DELETE MY SELLERHISAB ACCOUNT") });

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers: { "cache-control": "no-store" } });
  try {
    await enforceRateLimit(request, "account-export", user.id, 3, 60 * 60);
    const payload = await buildAccountExport(user);
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="sellerhisab-account-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store, max-age=0",
        pragma: "no-cache",
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))), "cache-control": "no-store" } });
    return Response.json({ error: error instanceof Error ? error.message : "Account export failed." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401, headers: { "cache-control": "no-store" } });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin account deletion blocked." }, { status: 403, headers: { "cache-control": "no-store" } });
  try {
    await enforceIpRateLimit(request, "account-delete-ip", 6, 60 * 60);
    await enforceRateLimit(request, "account-delete", user.id, 3, 24 * 60 * 60);
    deleteSchema.parse(await request.json());
    const result = await deleteAccountData(user);
    return Response.json({ ok: true, receiptId: result.receiptId }, { headers: { "set-cookie": clearSessionCookie(), "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))), "cache-control": "no-store" } });
    if (error instanceof z.ZodError) return Response.json({ error: "Type the exact deletion confirmation phrase." }, { status: 400, headers: { "cache-control": "no-store" } });
    if (error instanceof AccountDeletionBlockedError) return Response.json({ error: error.message }, { status: 409, headers: { "cache-control": "no-store" } });
    return Response.json({ error: "Account deletion could not be completed safely. No partial deletion was committed." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
