import { getSessionUser } from "@/server/auth";
import { connectorRedirectUri, exchangeFlipkartCode } from "@/server/connectors/providers";
import { consumeOauthState, upsertConnectedAccount } from "@/server/connectors/store";

export const dynamic = "force-dynamic";

function finish(request: Request, status: "connected" | "error", message: string) {
  const url = new URL("/app/connections", request.url);
  url.searchParams.set("connector", "flipkart-v1");
  url.searchParams.set("status", status);
  url.searchParams.set("message", message.slice(0, 180));
  return Response.redirect(url, 303);
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return finish(request, "error", "Sign in again, then reconnect Flipkart.");

  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    if (!state || !code) return finish(request, "error", "Flipkart returned an incomplete authorization response.");

    const oauth = await consumeOauthState({ userId: user.id, connectorId: "flipkart-v1", state });
    if (!oauth) return finish(request, "error", "Flipkart connection request expired or was already used.");
    const credential = await exchangeFlipkartCode({
      code,
      state,
      redirectUri: connectorRedirectUri(request, "flipkart-v1"),
    });
    const stableSellerId = credential.sellerId || `seller-${oauth.tenantId}`;
    await upsertConnectedAccount({
      userId: user.id,
      tenantId: oauth.tenantId,
      connectorId: "flipkart-v1",
      channelId: "flipkart",
      externalAccountId: stableSellerId,
      displayName: "Flipkart Seller",
      mode: "seller-api",
      enabledCapabilities: ["read-orders"],
      grantedScopes: credential.scope?.split(/[ ,]+/).filter(Boolean) ?? ["Seller_Api"],
      credential,
    });
    return finish(request, "connected", "Flipkart connected for order sync. Settlement remains validated-file-first.");
  } catch {
    return finish(request, "error", "Flipkart connection could not be completed. Try reconnecting.");
  }
}
