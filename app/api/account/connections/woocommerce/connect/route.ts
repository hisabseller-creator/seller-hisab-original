import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { connectorApiConfigured, woocommerceApiGet } from "@/server/connectors/providers";
import { upsertConnectedAccount, type StoredConnectorCredential } from "@/server/connectors/store";
import { normalizeWooCommerceStoreUrl, validWooCommerceConsumerKey, validWooCommerceConsumerSecret } from "@/core/connectors/woocommerce";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  storeUrl: z.string().trim().min(8).max(240),
  consumerKey: z.string().trim().min(20).max(160),
  consumerSecret: z.string().trim().min(20).max(160),
});

function safeProviderMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "WooCommerce connection failed.";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 220);
}

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin connection request blocked." }, { status: 403 });

  try {
    const access = await requireWorkspaceCapability(user, "connector_manage");
    await enforceRateLimit(request, "connector-woocommerce-connect", user.id, 8, 60 * 60);
    if (!connectorApiConfigured("woocommerce-v1")) return Response.json({ error: "Connector encryption is not configured on SellerHisab yet." }, { status: 503 });
    const input = inputSchema.parse(await request.json());
    const storeUrl = normalizeWooCommerceStoreUrl(input.storeUrl);
    if (!storeUrl) return Response.json({ error: "Use the public HTTPS WooCommerce store URL (no localhost/private IP/custom port)." }, { status: 400 });
    if (!validWooCommerceConsumerKey(input.consumerKey) || !validWooCommerceConsumerSecret(input.consumerSecret)) {
      return Response.json({ error: "Use a WooCommerce REST API Consumer Key (ck_...) and Consumer Secret (cs_...) generated with Read permission." }, { status: 400 });
    }

    const credential: StoredConnectorCredential = {
      provider: "woocommerce",
      storeUrl,
      consumerKey: input.consumerKey,
      consumerSecret: input.consumerSecret,
      scope: "read",
    };
    const probe = await woocommerceApiGet(credential, "/orders", new URLSearchParams({ per_page: "1", page: "1" }));
    if (!Array.isArray(probe)) throw new Error("WooCommerce Orders API did not return the expected read response.");

    const url = new URL(storeUrl);
    const connection = await upsertConnectedAccount({
      userId: user.id,
      tenantId: access.tenantId,
      connectorId: "woocommerce-v1",
      channelId: "woocommerce",
      externalAccountId: storeUrl,
      displayName: url.hostname,
      mode: "seller-api",
      enabledCapabilities: ["read-orders"],
      grantedScopes: ["read"],
      credential,
    });
    return Response.json({ connected: true, connectorId: "woocommerce-v1", displayName: connection.displayName, syncRequiresPlan: "pro" });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } });
    if (error instanceof z.ZodError) return Response.json({ error: "Enter a valid store URL and WooCommerce read-only API key pair." }, { status: 400 });
    return Response.json({ error: safeProviderMessage(error) }, { status: 503 });
  }
}
