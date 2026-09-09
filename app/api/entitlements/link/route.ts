import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { linkEntitlementToUser, validateEntitlement } from "@/server/entitlements";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
const schema = z.object({
  analysisId: z.string().regex(/^ana_[a-z0-9_]{6,80}$/),
  token: z.string().min(20).max(4_000),
});

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ linked: false }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ linked: false }, { status: 403 });
  try {
    await enforceRateLimit(request, "entitlement-link", user.id, 20, 60 * 60);
    const input = schema.parse(await request.json());
    if (!await validateEntitlement(input.token, input.analysisId)) return Response.json({ linked: false }, { status: 403 });
    const linked = await linkEntitlementToUser(input.analysisId, user.id);
    return Response.json({ linked }, { status: linked ? 200 : 409 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ linked: false }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } });
    }
    return Response.json({ linked: false }, { status: 400 });
  }
}
