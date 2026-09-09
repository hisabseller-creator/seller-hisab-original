import {sha256} from "@/server/crypto";
import {enforceRateLimit,RateLimitError} from "@/server/rate-limit";
import {getD1} from "@/server/runtime";
import { z } from "zod";
import { seoSettingsSchema } from "@/core/seo-settings";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { getPublicSeoSettings, savePublicSeoSettings, seoSettingsSnapshot, seoSettingsImpact, SeoSettingsConflict } from "@/server/seo-settings";

export const dynamic = "force-dynamic";

async function authorize(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return { error: Response.json({ error: "Sign in required." }, { status: 401 }) } as const;
  if (!isAdminUser(user.email, user.phone)) return { error: Response.json({ error: "Admin access is not enabled for this account." }, { status: 403 }) } as const;
  return { user } as const;
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  return Response.json({ settings: await getPublicSeoSettings() });
}

export async function PUT(request: Request) {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin update blocked." }, { status: 403 });
  try {
    await enforceRateLimit(request,"admin-seo-settings",auth.user.id,20,3600);
    const settings = seoSettingsSchema.parse(await request.json());
    const snapshot=await seoSettingsSnapshot(),previous=snapshot.settings;
    const confirmation=await sha256(JSON.stringify({previous,settings}));
    if(request.headers.get("x-seo-confirmation")!==confirmation)return Response.json({error:"Review the site-wide crawler/indexing impact before publishing.",confirmation,previous,settings,impact:seoSettingsImpact(previous,settings)},{status:409});
    const updatedAt = await savePublicSeoSettings(settings, auth.user.id, snapshot.revision);
    return Response.json({ settings, updatedAt });
  } catch (error) {
    if(error instanceof SeoSettingsConflict)return Response.json({error:error.message},{status:409});
    if (error instanceof RateLimitError) return Response.json({error:error.message},{status:429});
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Invalid SEO settings." }, { status: 400 });
    return Response.json({ error: "SEO settings could not be published." }, { status: 503 });
  }
}

// Rollback restores the exact preceding settings and creates another audit event.
export async function POST(request:Request){
 const auth=await authorize(request);if('error' in auth)return auth.error;
 if(!requestHasSameOrigin(request))return new Response(null,{status:403});
 const row=await getD1().prepare("SELECT metadata_json AS metadata FROM audit_events WHERE action='seo.settings.changed' ORDER BY created_at DESC,id DESC LIMIT 1").first<{metadata:string}>();
 if(!row)return Response.json({error:'No rollback version is available.'},{status:404});
 const settings=seoSettingsSchema.parse(JSON.parse(row.metadata).before);
 // Preview only. Client must use the same PUT confirmation flow to apply.
 return Response.json({settings});
}
