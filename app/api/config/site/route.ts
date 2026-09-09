import { getPublicSiteSettings } from "@/server/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getPublicSiteSettings(), {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" },
  });
}

