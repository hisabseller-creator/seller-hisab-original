import { z } from "zod";
import { requestHasSameOrigin } from "@/server/admin";
import { getSessionUser } from "@/server/auth";
import { requireWorkspaceCapability, WorkspacePermissionError } from "@/server/workspace-access";
import { normalizeShopifyShop, type OAuthApiConnectorId } from "@/core/connectors/api-runtime";
import { connectorApiConfigured, connectorRedirectUri, providerAuthorizationUrl } from "@/server/connectors/providers";
import { createOauthState } from "@/server/connectors/store";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  connectorId: z.enum(["amazon-in-v1", "flipkart-v1", "shopify-v1"]),
  shop: z.string().trim().max(180).optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin connection request blocked." }, { status: 403 });

  try {
    // Connecting an account is free. Pro is enforced later when the seller
    // requests marketplace sync / API-backed analysis.
    await requireWorkspaceCapability(user, "connector_manage");
    await enforceRateLimit(request, "connector-oauth-start", user.id, 12, 60 * 60);
    const input = inputSchema.parse(await request.json());
    const connectorId = input.connectorId as OAuthApiConnectorId;
    if (!connectorApiConfigured(connectorId)) {
      return Response.json({
        error: "Official API setup is not configured on SellerHisab yet. File analysis remains available.",
        code: "connector_not_configured",
      }, { status: 503 });
    }

    const shop = connectorId === "shopify-v1" ? (normalizeShopifyShop(input.shop ?? "") ?? undefined) : undefined;
    if (connectorId === "shopify-v1" && !shop) {
      return Response.json({ error: "Enter a valid Shopify .myshopify.com store." }, { status: 400 });
    }

    const state = await createOauthState({
      user,
      connectorId,
      context: shop ? { shop } : {},
      ttlMinutes: 10,
    });
    const redirectUri = connectorRedirectUri(request, connectorId);
    const authorizationUrl = providerAuthorizationUrl({ connectorId, state, redirectUri, shop });

    return Response.json({ authorizationUrl, connectorId, syncRequiresPlan: "pro" });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000))) } },
      );
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Choose a supported official connector." }, { status: 400 });
    return Response.json({ error: "Marketplace authorization could not be started." }, { status: 503 });
  }
}
