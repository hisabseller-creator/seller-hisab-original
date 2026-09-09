import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { restoreEntitlement } from "@/server/entitlements";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
const schema = z.object({ analysisId: z.string().regex(/^ana_[a-z0-9_]{6,80}$/) });

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ restored: false }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ restored: false }, { status: 403 });
  try {
    await enforceRateLimit(request, "entitlement-restore", user.id, 30, 60 * 60);
    const { analysisId } = schema.parse(await request.json());
    const entitlementToken = await restoreEntitlement(analysisId, user.id);
    return Response.json({ restored: Boolean(entitlementToken), entitlementToken });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ restored: false }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } });
    }
    return Response.json({ restored: false }, { status: 400 });
  }
}
