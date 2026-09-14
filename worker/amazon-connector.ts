/**
 * SellerHisab — Amazon SP-API internal connector Worker.
 *
 * This Worker is NOT publicly routable. It is invoked exclusively via
 * Cloudflare Service Binding (RPC) from the public SellerHisab Worker.
 *
 * Isolation boundary:
 * - Receives ONLY Amazon-specific secrets (LWA client ID/secret, connector encryption key).
 * - Has NO public custom domain or workers.dev route.
 * - Has NO access to blog R2, billing queue, admin secrets, or unrelated marketplace credentials.
 * - Amazon LWA refresh/access tokens never cross the Service Binding boundary.
 *
 * The public Worker sends an authorization code + redirect URI + seller ID;
 * this Worker exchanges it, encrypts the credential, stores it, and returns
 * only a non-secret connection result.
 */
import { WorkerEntrypoint } from "cloudflare:workers";

interface AmazonEnv {
  AMAZON_DB: D1Database;
  AMAZON_LWA_CLIENT_ID: string;
  AMAZON_LWA_CLIENT_SECRET: string;
  AMAZON_SPAPI_APPLICATION_ID: string;
  AMAZON_SPAPI_DRAFT?: string;
  AMAZON_CONNECTOR_ENCRYPTION_KEY: string;
}

/* ------------------------------------------------------------------ */
/*  Encryption (duplicated intentionally to avoid cross-worker import  */
/*  of the public Worker's crypto module and its ambient dependencies) */
/* ------------------------------------------------------------------ */

const encoder = new TextEncoder();

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function encryptJson<T>(value: T, secret: string): Promise<{ ciphertext: string; iv: string }> {
  if (secret.length < 32) throw new Error("Amazon connector encryption key must be at least 32 characters.");
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const key = await crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { ciphertext: base64url(new Uint8Array(encrypted)), iv: base64url(iv) };
}

/* ------------------------------------------------------------------ */
/*  Amazon LWA token exchange                                          */
/* ------------------------------------------------------------------ */

const AMAZON_SPAPI_ENDPOINT = "https://sellingpartnerapi-eu.amazon.com";

type AmazonCredential = {
  provider: "amazon";
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  sellerId: string;
  accessExpiresAt?: number;
};

async function exchangeAmazonCode(env: AmazonEnv, input: {
  code: string;
  redirectUri: string;
  sellerId: string;
}): Promise<AmazonCredential> {
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: env.AMAZON_LWA_CLIENT_ID,
      client_secret: env.AMAZON_LWA_CLIENT_SECRET,
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Amazon LWA returned HTTP ${response.status}.`);
  const payload = await response.json() as Record<string, unknown>;
  const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token.trim() : "";
  if (!accessToken || !refreshToken) throw new Error("Amazon did not return the required LWA tokens.");
  const expiresIn = Number(payload.expires_in);
  return {
    provider: "amazon",
    accessToken,
    refreshToken,
    tokenType: (typeof payload.token_type === "string" ? payload.token_type : "bearer"),
    sellerId: input.sellerId,
    accessExpiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  RPC methods exposed to the public Worker via Service Binding       */
/* ------------------------------------------------------------------ */

export type AmazonConnectionResult = {
  connectionId: string;
  channelAccountId: string;
  externalAccountId: string;
  displayName: string;
  status: "connected";
};

export default class AmazonConnectorService extends WorkerEntrypoint<AmazonEnv> {
  /**
   * Exchange an Amazon OAuth authorization code for LWA tokens,
   * encrypt them, and store the encrypted credential in the
   * Amazon-specific D1 database.
   *
   * The public Worker must NOT receive the raw tokens.
   */
  async exchangeAndStore(input: {
    code: string;
    redirectUri: string;
    sellerId: string;
    tenantId: string;
    userId: string;
    connectorId: string;
    channelId: string;
  }): Promise<AmazonConnectionResult> {
    const credential = await exchangeAmazonCode(this.env, {
      code: input.code,
      redirectUri: input.redirectUri,
      sellerId: input.sellerId,
    });

    const encryptionKey = this.env.AMAZON_CONNECTOR_ENCRYPTION_KEY;
    const encrypted = await encryptJson(credential, encryptionKey);

    const accountDigest = await sha256(`${input.tenantId}:${input.channelId}:${input.sellerId}`);
    const connectionDigest = await sha256(`${input.tenantId}:${input.connectorId}:${input.sellerId}`);
    const channelAccountId = `cha_${accountDigest.slice(0, 24)}`;
    const connectionId = `con_${connectionDigest.slice(0, 24)}`;
    const now = new Date().toISOString();
    const displayName = `Amazon India • ${input.sellerId.slice(-6)}`;

    const db = this.env.AMAZON_DB;
    await db.batch([
      db.prepare(`
        INSERT INTO amazon_channel_accounts
          (id, tenant_id, channel_id, external_account_id, display_name, region, currency, status, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, 'IN', 'INR', 'active', ?6, ?6)
        ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, status = 'active', updated_at = excluded.updated_at
      `).bind(channelAccountId, input.tenantId, input.channelId, input.sellerId, displayName, now),
      db.prepare(`
        INSERT INTO amazon_connector_connections
          (id, tenant_id, channel_account_id, connector_id, mode, status, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, 'oauth-api', 'connected', ?5, ?5)
        ON CONFLICT(id) DO UPDATE SET
          channel_account_id = excluded.channel_account_id,
          status = 'connected',
          updated_at = excluded.updated_at
      `).bind(connectionId, input.tenantId, channelAccountId, input.connectorId, now),
      db.prepare(`
        INSERT INTO amazon_connector_credentials
          (connection_id, encrypted_payload, iv, key_version, expires_at, updated_at)
        VALUES (?1, ?2, ?3, 'v1', ?4, ?5)
        ON CONFLICT(connection_id) DO UPDATE SET
          encrypted_payload = excluded.encrypted_payload,
          iv = excluded.iv,
          key_version = excluded.key_version,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
      `).bind(connectionId, encrypted.ciphertext, encrypted.iv, credential.accessExpiresAt ?? null, now),
      db.prepare(`
        INSERT INTO amazon_connector_audit
          (id, tenant_id, user_id, action, resource_id, metadata_json, created_at)
        VALUES (?1, ?2, ?3, 'amazon.connected', ?4, ?5, ?6)
      `).bind(
        `aaud_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
        input.tenantId,
        input.userId,
        connectionId,
        JSON.stringify({ connectorId: input.connectorId, channelId: input.channelId }),
        now,
      ),
    ]);

    return { connectionId, channelAccountId, externalAccountId: input.sellerId, displayName, status: "connected" };
  }

  /**
   * Build the Amazon SP-API authorization URL.
   * Called via Service Binding so the public Worker never touches the LWA client ID directly.
   */
  buildAuthorizationUrl(input: {
    state: string;
    redirectUri: string;
  }): string {
    const params = new URLSearchParams({
      application_id: this.env.AMAZON_SPAPI_APPLICATION_ID,
      state: input.state,
      redirect_uri: input.redirectUri,
    });
    if (this.env.AMAZON_SPAPI_DRAFT?.toLowerCase() === "true") {
      params.set("version", "beta");
    }
    return `https://sellercentral.amazon.in/apps/authorize/consent?${params}`;
  }

  /**
   * Check whether the Amazon connector is configured on this internal Worker.
   */
  isConfigured(): boolean {
    return Boolean(
      this.env.AMAZON_LWA_CLIENT_ID
      && this.env.AMAZON_LWA_CLIENT_SECRET
      && this.env.AMAZON_SPAPI_APPLICATION_ID
      && this.env.AMAZON_CONNECTOR_ENCRYPTION_KEY
      && this.env.AMAZON_CONNECTOR_ENCRYPTION_KEY.length >= 32,
    );
  }

  /**
   * Dummy fetch handler required by Cloudflare for deployment.
   * This Worker is not routable via the public internet anyway.
   */
  async fetch(request: Request): Promise<Response> {
    return new Response("Forbidden: Internal Amazon Connector Worker", { status: 403 });
  }
}

