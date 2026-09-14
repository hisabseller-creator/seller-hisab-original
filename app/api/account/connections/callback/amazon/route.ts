import { getSessionUser } from "@/server/auth";
import { consumeOauthState } from "@/server/connectors/store";
import { connectorRedirectUri } from "@/server/connectors/providers";
import { runtimeEnv } from "@/server/runtime";

export const dynamic = "force-dynamic";

function finish(request: Request, status: "connected" | "error", message: string) {
  const url = new URL("/app/connections", request.url);
  url.searchParams.set("connector", "amazon-in-v1");
  url.searchParams.set("status", status);
  url.searchParams.set("message", message.slice(0, 180));
  return Response.redirect(url, 303);
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return finish(request, "error", "Sign in again, then reconnect Amazon India.");

  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("spapi_oauth_code") ?? "";
    const sellerId = url.searchParams.get("selling_partner_id")?.trim() ?? "";
    if (!state || !code || !sellerId) return finish(request, "error", "Amazon returned an incomplete authorization response.");

    const oauth = await consumeOauthState({ userId: user.id, connectorId: "amazon-in-v1", state });
    if (!oauth) return finish(request, "error", "Amazon connection request expired or was already used.");

    // --- Network segmentation boundary ---
    // The Amazon OAuth authorization code is forwarded to the internal Amazon
    // connector Worker via Cloudflare Service Binding (RPC). The internal Worker
    // exchanges the code for LWA tokens, encrypts them with its own key material,
    // and stores them in the Amazon-specific D1 database.
    //
    // Raw Amazon access/refresh tokens NEVER enter the public Worker.
    const env = runtimeEnv();
    const amazonService = (env as Record<string, unknown>).AMAZON_SERVICE as
      | { exchangeAndStore: (input: Record<string, string>) => Promise<{ connectionId: string; displayName: string; status: string }> }
      | undefined;

    if (amazonService && typeof amazonService.exchangeAndStore === "function") {
      // Service Binding path — production with segmented architecture
      const result = await amazonService.exchangeAndStore({
        code,
        redirectUri: connectorRedirectUri(request, "amazon-in-v1"),
        sellerId,
        tenantId: oauth.tenantId,
        userId: user.id,
        connectorId: "amazon-in-v1",
        channelId: "amazon-in",
      });
      return finish(request, "connected", `Amazon India connected (${result.displayName}). Finance sync depends on the roles approved for your SP-API app.`);
    }

    // Fallback path — local development or pre-segmentation deployment.
    // Uses the existing direct exchange path in the public Worker.
    const { exchangeAmazonCode } = await import("@/server/connectors/providers");
    const { upsertConnectedAccount } = await import("@/server/connectors/store");
    const credential = await exchangeAmazonCode({
      code,
      sellerId,
      redirectUri: connectorRedirectUri(request, "amazon-in-v1"),
    });
    await upsertConnectedAccount({
      userId: user.id,
      tenantId: oauth.tenantId,
      connectorId: "amazon-in-v1",
      channelId: "amazon-in",
      externalAccountId: sellerId,
      displayName: `Amazon India • ${sellerId.slice(-6)}`,
      mode: "oauth-api",
      enabledCapabilities: ["read-orders", "read-settlements"],
      grantedScopes: ["selling-partner-authorization"],
      credential,
    });
    return finish(request, "connected", "Amazon India connected. Finance sync depends on the roles approved for your SP-API app.");
  } catch {
    return finish(request, "error", "Amazon India connection could not be completed. Try reconnecting.");
  }
}
