import { runtimeEnv } from "@/server/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = runtimeEnv();
  const widgetId = env.MSG91_WIDGET_ID?.trim();
  const tokenAuth = env.MSG91_WIDGET_TOKEN?.trim();
  const enabled = Boolean(widgetId && tokenAuth);

  return Response.json(
    enabled
      ? { enabled: true, widgetId, tokenAuth }
      : { enabled: false, error: "Mobile OTP is not configured yet." },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
