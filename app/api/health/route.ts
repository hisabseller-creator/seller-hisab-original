import { getD1 } from "@/server/runtime";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const result = await getD1().prepare("SELECT 1 AS ok").first<{ ok: number }>();
    if (result?.ok !== 1) throw new Error("Health probe failed");
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
