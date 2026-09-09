import { buildOfficialAuthorizationUrl, canonicalShopifyHmacMessage, defaultShopifyScopes, normalizeShopifyShop, type ApiConnectorId, type OAuthApiConnectorId } from "@/core/connectors/api-runtime";
import { buildWooCommerceApiUrl, normalizeWooCommerceStoreUrl } from "@/core/connectors/woocommerce";
import { constantTimeEqual, hmacSha256 } from "../crypto";
import { providerFetch, ProviderTransportError, retryAfterMs } from "../provider-http";
import { runtimeEnv } from "../runtime";
import { assertWooCommercePublicDestination } from "./ssrf";
import type { StoredConnectorCredential } from "./store";

const SHOPIFY_API_VERSION = "2026-07";
const AMAZON_INDIA_MARKETPLACE_ID = "A21TJRUUN4KGV";
const AMAZON_SPAPI_ENDPOINT = "https://sellingpartnerapi-eu.amazon.com";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function positiveSeconds(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function expiresAt(seconds: unknown): number | undefined {
  const ttl = positiveSeconds(seconds);
  return ttl ? Date.now() + ttl * 1000 : undefined;
}

async function jsonFetch(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await providerFetch(url, init, {safeRead:(init.method??"GET")==="GET" || (typeof init.body==="string" && /^\s*\{\s*"query"/.test(init.body) && !/\bmutation\b/.test(init.body))});
  const body = await response.text();
  let payload: Record<string, unknown> = {};
  try { payload = object(JSON.parse(body)); } catch { /* use HTTP status below */ }
  if (!response.ok) {
    if (response.status === 429) throw new ProviderTransportError("provider_throttled",429,retryAfterMs(response.headers.get("retry-after")));
    const message = `Marketplace API returned HTTP ${response.status}.`;
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = text(payload.error) || `http_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function connectorApiConfigured(connectorId: ApiConnectorId): boolean {
  const env = runtimeEnv();
  const encryptionKey = env.CONNECTOR_ENCRYPTION_KEY_V2 || env.CONNECTOR_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length < 32) return false;
  if (connectorId === "woocommerce-v1") return true;
  if (connectorId === "shopify-v1") return Boolean(env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET);
  if (connectorId === "amazon-in-v1") return Boolean(env.AMAZON_SPAPI_APPLICATION_ID && env.AMAZON_LWA_CLIENT_ID && env.AMAZON_LWA_CLIENT_SECRET);
  return Boolean(env.FLIPKART_CLIENT_ID && env.FLIPKART_CLIENT_SECRET);
}

export function connectorRedirectUri(request: Request, connectorId: OAuthApiConnectorId): string {
  const env = runtimeEnv();
  const slug = connectorId === "amazon-in-v1" ? "amazon" : connectorId === "flipkart-v1" ? "flipkart" : "shopify";
  const fallbackOrigin = env.APP_ENV === "production" ? "https://sellerhisab.com" : new URL(request.url).origin;
  const configured = env.CONNECTOR_CALLBACK_ORIGIN?.trim() || fallbackOrigin;
  const parsed = new URL(configured);
  if (env.APP_ENV === "production") {
    if (parsed.protocol !== "https:" || parsed.origin !== "https://sellerhisab.com") throw new Error("Production connector callbacks must use the exact https://sellerhisab.com origin.");
  } else if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Connector callback origin must use HTTP or HTTPS.");
  }
  return `${parsed.origin}/api/account/connections/callback/${slug}`;
}

export function providerAuthorizationUrl(input: {
  connectorId: OAuthApiConnectorId;
  state: string;
  redirectUri: string;
  shop?: string;
}): string {
  const env = runtimeEnv();
  if (!connectorApiConfigured(input.connectorId)) throw new Error("This official connector is not configured on SellerHisab yet.");
  if (input.connectorId === "shopify-v1") {
    return buildOfficialAuthorizationUrl({
      connectorId: input.connectorId,
      state: input.state,
      redirectUri: input.redirectUri,
      clientId: env.SHOPIFY_CLIENT_ID!,
      shop: input.shop,
      scopes: defaultShopifyScopes(env.SHOPIFY_SCOPES),
    });
  }
  if (input.connectorId === "amazon-in-v1") {
    return buildOfficialAuthorizationUrl({
      connectorId: input.connectorId,
      state: input.state,
      redirectUri: input.redirectUri,
      clientId: env.AMAZON_LWA_CLIENT_ID!,
      amazonApplicationId: env.AMAZON_SPAPI_APPLICATION_ID!,
      amazonDraft: env.AMAZON_SPAPI_DRAFT?.toLowerCase() === "true",
    });
  }
  return buildOfficialAuthorizationUrl({
    connectorId: input.connectorId,
    state: input.state,
    redirectUri: input.redirectUri,
    clientId: env.FLIPKART_CLIENT_ID!,
  });
}

export async function verifyShopifyCallbackHmac(url: URL): Promise<boolean> {
  const secret = runtimeEnv().SHOPIFY_CLIENT_SECRET;
  const provided = url.searchParams.get("hmac") ?? "";
  if (!secret || !provided) return false;
  const expected = await hmacSha256(secret, canonicalShopifyHmacMessage(url.searchParams));
  return constantTimeEqual(provided.toLowerCase(), expected.toLowerCase());
}

export async function exchangeShopifyCode(input: { shop: string; code: string }): Promise<StoredConnectorCredential> {
  const env = runtimeEnv();
  const shop = normalizeShopifyShop(input.shop);
  if (!shop || !env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) throw new Error("Shopify OAuth is not configured.");
  const payload = await jsonFetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
      code: input.code,
      expiring: "1",
    }),
  });
  const accessToken = text(payload.access_token);
  if (!accessToken) throw new Error("Shopify did not return an access token.");
  return {
    provider: "shopify",
    shop,
    accessToken,
    refreshToken: text(payload.refresh_token) || undefined,
    tokenType: "bearer",
    scope: text(payload.scope),
    accessExpiresAt: expiresAt(payload.expires_in),
    refreshExpiresAt: expiresAt(payload.refresh_token_expires_in),
  };
}

export async function refreshShopifyCredential(credential: StoredConnectorCredential): Promise<StoredConnectorCredential> {
  const env = runtimeEnv();
  if (!credential.shop || !credential.refreshToken || !env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) return credential;
  const payload = await jsonFetch(`https://${credential.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: env.SHOPIFY_CLIENT_ID,
      client_secret: env.SHOPIFY_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
    }),
  });
  const accessToken = text(payload.access_token);
  if (!accessToken) throw new Error("Shopify token refresh did not return an access token.");
  return {
    ...credential,
    accessToken,
    refreshToken: text(payload.refresh_token) || credential.refreshToken,
    scope: text(payload.scope) || credential.scope,
    accessExpiresAt: expiresAt(payload.expires_in),
    refreshExpiresAt: expiresAt(payload.refresh_token_expires_in) ?? credential.refreshExpiresAt,
  };
}

export async function readShopifyIdentity(credential: StoredConnectorCredential): Promise<{ externalAccountId: string; displayName: string }> {
  if (!credential.shop || !credential.accessToken) throw new Error("Shopify authorization is incomplete.");
  const payload = await shopifyGraphql(credential, `query SellerHisabShopIdentity { shop { id name myshopifyDomain } }`, {});
  const shop = object(object(payload.data).shop);
  const externalAccountId = text(shop.id) || credential.shop;
  return { externalAccountId, displayName: text(shop.name) || credential.shop };
}

export async function exchangeAmazonCode(input: {
  code: string;
  redirectUri: string;
  sellerId: string;
}): Promise<StoredConnectorCredential> {
  const env = runtimeEnv();
  if (!env.AMAZON_LWA_CLIENT_ID || !env.AMAZON_LWA_CLIENT_SECRET) throw new Error("Amazon SP-API OAuth is not configured.");
  const payload = await jsonFetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: env.AMAZON_LWA_CLIENT_ID,
      client_secret: env.AMAZON_LWA_CLIENT_SECRET,
    }),
  });
  const accessToken = text(payload.access_token);
  const refreshToken = text(payload.refresh_token);
  if (!accessToken || !refreshToken) throw new Error("Amazon did not return the required LWA tokens.");
  return {
    provider: "amazon",
    sellerId: input.sellerId,
    accessToken,
    refreshToken,
    tokenType: text(payload.token_type) || "bearer",
    accessExpiresAt: expiresAt(payload.expires_in),
  };
}

export async function refreshAmazonCredential(credential: StoredConnectorCredential): Promise<StoredConnectorCredential> {
  const env = runtimeEnv();
  if (!credential.refreshToken || !env.AMAZON_LWA_CLIENT_ID || !env.AMAZON_LWA_CLIENT_SECRET) throw new Error("Amazon refresh authorization is unavailable.");
  const payload = await jsonFetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
      client_id: env.AMAZON_LWA_CLIENT_ID,
      client_secret: env.AMAZON_LWA_CLIENT_SECRET,
    }),
  });
  const accessToken = text(payload.access_token);
  if (!accessToken) throw new Error("Amazon token refresh did not return an access token.");
  return { ...credential, accessToken, accessExpiresAt: expiresAt(payload.expires_in) };
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

export async function exchangeFlipkartCode(input: { code: string; state: string; redirectUri: string }): Promise<StoredConnectorCredential> {
  const env = runtimeEnv();
  if (!env.FLIPKART_CLIENT_ID || !env.FLIPKART_CLIENT_SECRET) throw new Error("Flipkart OAuth is not configured.");
  const payload = await jsonFetch("https://api.flipkart.net/oauth-service/oauth/token", {
    method: "POST",
    headers: {
      authorization: basicAuth(env.FLIPKART_CLIENT_ID, env.FLIPKART_CLIENT_SECRET),
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
      state: input.state,
      code: input.code,
    }),
  });
  const accessToken = text(payload.access_token);
  const refreshToken = text(payload.refresh_token);
  if (!accessToken || !refreshToken) throw new Error("Flipkart did not return the required OAuth tokens.");
  return {
    provider: "flipkart",
    sellerId: text(payload.seller_id ?? payload.sellerId) || undefined,
    accessToken,
    refreshToken,
    tokenType: text(payload.token_type) || "bearer",
    scope: text(payload.scope) || "Seller_Api",
    accessExpiresAt: expiresAt(payload.expires_in),
    refreshExpiresAt: expiresAt(payload.refresh_token_expires_in),
  };
}

export async function refreshFlipkartCredential(credential: StoredConnectorCredential): Promise<StoredConnectorCredential> {
  const env = runtimeEnv();
  if (!credential.refreshToken || !env.FLIPKART_CLIENT_ID || !env.FLIPKART_CLIENT_SECRET) throw new Error("Flipkart refresh authorization is unavailable.");
  const payload = await jsonFetch("https://api.flipkart.net/oauth-service/oauth/token", {
    method: "POST",
    headers: {
      authorization: basicAuth(env.FLIPKART_CLIENT_ID, env.FLIPKART_CLIENT_SECRET),
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: credential.refreshToken }),
  });
  const accessToken = text(payload.access_token);
  if (!accessToken) throw new Error("Flipkart token refresh did not return an access token.");
  return {
    ...credential,
    accessToken,
    refreshToken: text(payload.refresh_token) || credential.refreshToken,
    scope: text(payload.scope) || credential.scope,
    accessExpiresAt: expiresAt(payload.expires_in),
    refreshExpiresAt: expiresAt(payload.refresh_token_expires_in) ?? credential.refreshExpiresAt,
  };
}

export async function ensureFreshCredential(credential: StoredConnectorCredential): Promise<StoredConnectorCredential> {
  if (credential.provider === "woocommerce") return credential;
  const refreshThreshold = Date.now() + 5 * 60_000;
  if (credential.accessToken && (!credential.accessExpiresAt || credential.accessExpiresAt > refreshThreshold)) return credential;
  if (credential.provider === "shopify") return refreshShopifyCredential(credential);
  if (credential.provider === "amazon") return refreshAmazonCredential(credential);
  return refreshFlipkartCredential(credential);
}

export async function shopifyGraphql(credential: StoredConnectorCredential, query: string, variables: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!credential.shop || !credential.accessToken) throw new Error("Shopify authorization is incomplete.");
  const payload = await jsonFetch(`https://${credential.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-shopify-access-token": credential.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  if (errors.length) {
    if (errors.some(e => object(object(e).extensions).code === 'THROTTLED')) throw new ProviderTransportError('shopify_throttled',429,30000);
    throw new Error('Shopify GraphQL returned an error. Check app scopes and API compatibility.');
  }
  const cost=object(object(payload.extensions).cost), throttle=object(cost.throttleStatus);
  const available=Number(throttle.currentlyAvailable), rate=Number(throttle.restoreRate), requested=Number(cost.requestedQueryCost);
  if(Number.isFinite(available)&&rate>0&&requested>available)payload.nextReadAt=new Date(Date.now()+Math.ceil((requested-available)/rate*1000)).toISOString();
  return payload;
}

export async function amazonSpApiGet(credential: StoredConnectorCredential, path: string, params: URLSearchParams): Promise<Record<string, unknown>> {
  if (!credential.accessToken) throw new Error("Amazon authorization is incomplete.");
  const url = new URL(`${AMAZON_SPAPI_ENDPOINT}${path}`);
  params.forEach((value, key) => url.searchParams.append(key, value));
  return jsonFetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-amz-access-token": credential.accessToken,
      "x-amz-date": new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""),
      "user-agent": "SellerHisab/1.4.0 (Language=TypeScript; Platform=Cloudflare-Workers)",
    },
  });
}

export async function flipkartApi(input: { credential: StoredConnectorCredential; url: string; method?: "GET" | "POST"; body?: unknown }): Promise<Record<string, unknown>> {
  if (!input.credential.accessToken) throw new Error("Flipkart authorization is incomplete.");
  return jsonFetch(input.url, {
    method: input.method ?? "GET",
    headers: {
      authorization: `Bearer ${input.credential.accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
}

export async function woocommerceApiGet(credential: StoredConnectorCredential, path: string, params?: URLSearchParams): Promise<unknown> {
  if (credential.provider !== "woocommerce" || !credential.storeUrl || !credential.consumerKey || !credential.consumerSecret) {
    throw new Error("WooCommerce authorization is incomplete.");
  }
  const storeUrl = normalizeWooCommerceStoreUrl(credential.storeUrl);
  if (!storeUrl) throw new Error("WooCommerce store URL is no longer valid.");
  await assertWooCommercePublicDestination(storeUrl);
  const url = buildWooCommerceApiUrl(storeUrl, path, params);
  const response = await providerFetch(url, {
    method: "GET",
    headers: { authorization: basicAuth(credential.consumerKey, credential.consumerSecret), accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.text();
  let payload: unknown = {};
  try { payload = JSON.parse(body); } catch { /* handled through HTTP status/shape below */ }
  if (!response.ok) {
    const errorPayload = object(payload);
    const error = new Error(`WooCommerce API returned HTTP ${response.status}.`) as Error & { code?: string; status?: number };
    error.code = text(errorPayload.code) || `http_${response.status}`;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const providerConstants = {
  SHOPIFY_API_VERSION,
  AMAZON_INDIA_MARKETPLACE_ID,
  AMAZON_SPAPI_ENDPOINT,
} as const;
