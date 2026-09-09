import { z } from "zod";
import { siteSettingsSchema } from "@/core/site-settings";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { getPublicSiteSettings, savePublicSiteSettings } from "@/server/site-settings";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) } as const;
  if (!isAdminUser(user.email, user.phone)) {
    return { error: Response.json({ error: "Admin access is not enabled for this account." }, { status: 403 }) } as const;
  }
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  return Response.json({ settings: await getPublicSiteSettings(), user: auth.user });
}

export async function PUT(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    const settings = siteSettingsSchema.parse(await request.json());
    const updatedAt = await savePublicSiteSettings(settings, auth.user.id);
    return Response.json({ settings, updatedAt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "Invalid site settings." }, { status: 400 });
    }
    return Response.json({ error: "Site settings could not be published." }, { status: 503 });
  }
}

