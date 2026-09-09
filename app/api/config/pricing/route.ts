import { getPricing } from "@/server/pricing";

export const dynamic = "force-dynamic";

export function GET() {
  const pricing = getPricing();
  return Response.json(pricing, { headers: { "cache-control": "public, max-age=300" } });
}
