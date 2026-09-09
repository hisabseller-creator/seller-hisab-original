import { normalizeShopifyShop } from "@/core/connectors/api-runtime";
import { exchangeShopifyCode, readShopifyIdentity, verifyShopifyCallbackHmac } from "@/server/connectors/providers";
import { consumeOauthStateForCallback, upsertConnectedAccount } from "@/server/connectors/store";

export const dynamic = "force-dynamic";

function finish(request: Request, status: "connected" | "error", message: string) {
  const url = new URL("/app/connections", request.url);
  url.searchParams.set("connector", "shopify-v1");
  url.searchParams.set("status", status);
  url.searchParams.set("message", message.slice(0, 180));
  return Response.redirect(url, 303);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (!(await verifyShopifyCallbackHmac(url))) return finish(request, "error", "Shopify authorization could not be verified.");
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    const shop = normalizeShopifyShop(url.searchParams.get("shop") ?? "");
    if (!state || !code || !shop) return finish(request, "error", "Shopify returned an incomplete authorization response.");

    const oauth = await consumeOauthStateForCallback({ connectorId: "shopify-v1", state });
    if (!oauth) return finish(request, "error", "Shopify connection request expired or was already used.");
    const expectedShop = normalizeShopifyShop(typeof oauth.context.shop === "string" ? oauth.context.shop : "");
    if (!expectedShop || expectedShop !== shop) return finish(request, "error", "Shopify store did not match the connection request.");

    const credential = await exchangeShopifyCode({ shop, code });
    const identity = await readShopifyIdentity(credential);
    const grantedScopes = credential.scope?.split(",").map((scope) => scope.trim()).filter(Boolean) ?? [];
    const capabilities = ["read-orders"];
    if (grantedScopes.includes("read_shopify_payments") || grantedScopes.includes("read_shopify_payments_accounts")) capabilities.push("read-settlements");
    await upsertConnectedAccount({
      userId: oauth.userId,
      tenantId: oauth.tenantId,
      connectorId: "shopify-v1",
      channelId: "shopify",
      externalAccountId: identity.externalAccountId,
      displayName: identity.displayName,
      mode: "oauth-api",
      enabledCapabilities: capabilities,
      grantedScopes,
      credential,
    });
    return finish(request, "connected", "Shopify connected. You can now sync the last 30 days.");
  } catch {
    return finish(request, "error", "Shopify connection could not be completed. Try reconnecting.");
  }
}
