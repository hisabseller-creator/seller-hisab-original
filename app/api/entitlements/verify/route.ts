import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { validateEntitlement } from "@/server/entitlements";

export const dynamic = "force-dynamic";

const schema = z.object({
  analysisId: z.string().regex(/^ana_[a-z0-9_]{6,80}$/),
  token: z.string().min(20).max(4_000),
});

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ valid: false }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    return Response.json({ valid: await validateEntitlement(input.token, input.analysisId) });
  } catch {
    return Response.json({ valid: false }, { status: 400 });
  }
}
