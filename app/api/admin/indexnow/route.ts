import { z } from "zod";
import { isPrivateSearchPath } from "@/core/seo";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { submitIndexNow } from "@/server/indexnow";
import { getPublicSeoSettings } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  paths: z.array(z.string().trim().min(1).max(500)).min(1).max(100),
});

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isAdminUser(user.email, user.phone)) return Response.json({ error: "Admin access is not enabled for this account." }, { status: 403 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    const { paths } = inputSchema.parse(await request.json());
    const safe = [...new Set(paths.map((path) => path.startsWith("/") ? path : `/${path}`))]
      .filter((path) => !path.startsWith("//") && !isPrivateSearchPath(path));
    if (!safe.length) return Response.json({ error: "No public indexable paths were supplied." }, { status: 400 });
    const settings = await getPublicSeoSettings();
    if (!settings.indexNow.enabled) return Response.json({ error: "IndexNow is disabled in SEO settings." }, { status: 409 });
    const result = await submitIndexNow(safe);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Invalid paths." }, { status: 400 });
    return Response.json({ error: "IndexNow submission failed." }, { status: 503 });
  }
}
