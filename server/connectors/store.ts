import type { SessionUser } from "../auth";
import { decryptJson, encryptJson, randomId, sha256 } from "../crypto";
import { getD1, runtimeEnv } from "../runtime";
import type { ApiConnectorId } from "@/core/connectors/api-runtime";

export type StoredConnectorCredential = {
  provider: "shopify" | "amazon" | "flipkart" | "woocommerce";
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  shop?: string;
  sellerId?: string;
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
};

export type OwnedConnection = {
  id: string;
  tenantId: string;
  channelAccountId: string | null;
  connectorId: ApiConnectorId;
  status: string;
  externalAccountId: string | null;
  displayName: string | null;
};

function currentConnectorKey(): { version: "v1" | "v2"; secret: string } {
  const env = runtimeEnv();
  const version = env.CONNECTOR_ENCRYPTION_KEY_V2 ? "v2" : "v1";
  const secret = env.CONNECTOR_ENCRYPTION_KEY_V2 || env.CONNECTOR_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("Connector token encryption is not configured.");
  return { version, secret };
}

function connectorKeyForVersion(version: string): string {
  const env = runtimeEnv();
  const secret = version === "v2" ? env.CONNECTOR_ENCRYPTION_KEY_V2 : env.CONNECTOR_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("Connector encryption key version is unavailable; reconnect this marketplace or restore the previous key.");
  return secret;
}

export async function ensureTenantForUser(user: SessionUser): Promise<string> {
  const db = getD1();
  const preferred = await db.prepare(`
    SELECT wp.active_tenant_id AS id
    FROM workspace_preferences wp
    JOIN tenants t ON t.id = wp.active_tenant_id
    LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.user_id = ?1
    WHERE wp.user_id = ?1 AND (t.owner_user_id = ?1 OR tm.user_id = ?1)
    LIMIT 1
  `).bind(user.id).first<{ id: string }>();
  if (preferred?.id) return preferred.id;

  const existing = await db.prepare(`
    SELECT DISTINCT t.id
    FROM tenants t
    LEFT JOIN tenant_members tm ON tm.tenant_id = t.id
    WHERE t.owner_user_id = ?1 OR tm.user_id = ?1
    ORDER BY CASE WHEN t.owner_user_id = ?1 THEN 0 ELSE 1 END, t.created_at
    LIMIT 1
  `).bind(user.id).first<{ id: string }>();
  if (existing?.id) {
    await db.prepare(`INSERT INTO workspace_preferences (user_id, active_tenant_id, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET active_tenant_id = excluded.active_tenant_id, updated_at = excluded.updated_at`)
      .bind(user.id, existing.id, new Date().toISOString()).run();
    return existing.id;
  }

  const digest = await sha256(`tenant:${user.id}`);
  const tenantId = `ten_${digest.slice(0, 24)}`;
  const memberId = `tmem_${digest.slice(0, 24)}`;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      INSERT OR IGNORE INTO tenants (id, owner_user_id, name, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?4)
    `).bind(tenantId, user.id, "SellerHisab Business", now),
    db.prepare(`
      INSERT OR IGNORE INTO tenant_members (id, tenant_id, user_id, role, created_at)
      VALUES (?1, ?2, ?3, 'owner', ?4)
    `).bind(memberId, tenantId, user.id, now),
    db.prepare(`INSERT INTO workspace_preferences (user_id, active_tenant_id, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id) DO UPDATE SET active_tenant_id = excluded.active_tenant_id, updated_at = excluded.updated_at`)
      .bind(user.id, tenantId, now),
  ]);
  return tenantId;
}

export async function findUserTenantId(userId: string): Promise<string | null> {
  const db = getD1();
  const preferred = await db.prepare(`
    SELECT wp.active_tenant_id AS id
    FROM workspace_preferences wp
    JOIN tenants t ON t.id = wp.active_tenant_id
    LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.user_id = ?1
    WHERE wp.user_id = ?1 AND (t.owner_user_id = ?1 OR tm.user_id = ?1)
    LIMIT 1
  `).bind(userId).first<{ id: string }>();
  if (preferred?.id) return preferred.id;
  const row = await db.prepare(`
    SELECT DISTINCT t.id
    FROM tenants t
    LEFT JOIN tenant_members tm ON tm.tenant_id = t.id
    WHERE t.owner_user_id = ?1 OR tm.user_id = ?1
    ORDER BY CASE WHEN t.owner_user_id = ?1 THEN 0 ELSE 1 END, t.created_at
    LIMIT 1
  `).bind(userId).first<{ id: string }>();
  return row?.id ?? null;
}

export async function createOauthState(input: {
  user: SessionUser;
  connectorId: ApiConnectorId;
  context: Record<string, unknown>;
  ttlMinutes?: number;
}): Promise<string> {
  const tenantId = await ensureTenantForUser(input.user);
  const state = randomId("oauth");
  const stateHash = await sha256(state);
  const now = new Date().toISOString();
  const expiresAt = Date.now() + (input.ttlMinutes ?? 10) * 60_000;
  const db = getD1();
  await db.prepare("DELETE FROM connector_oauth_states WHERE expires_at < ?1").bind(Date.now()).run();
  await db.prepare(`
    INSERT INTO connector_oauth_states
      (id, tenant_id, user_id, connector_id, state_hash, context_json, expires_at, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `).bind(
    randomId("ost"),
    tenantId,
    input.user.id,
    input.connectorId,
    stateHash,
    JSON.stringify(input.context),
    expiresAt,
    now,
  ).run();
  return state;
}

export async function consumeOauthState(input: {
  userId: string;
  connectorId: ApiConnectorId;
  state: string;
}): Promise<{ tenantId: string; context: Record<string, unknown> } | null> {
  const stateHash = await sha256(input.state);
  const db = getD1();
  const row = await db.prepare(`
    SELECT id, tenant_id AS tenantId, context_json AS contextJson
    FROM connector_oauth_states
    WHERE state_hash = ?1 AND user_id = ?2 AND connector_id = ?3 AND expires_at > ?4
    LIMIT 1
  `).bind(stateHash, input.userId, input.connectorId, Date.now()).first<{ id: string; tenantId: string; contextJson: string }>();
  if (!row) return null;
  await db.prepare("DELETE FROM connector_oauth_states WHERE id = ?1").bind(row.id).run();
  try {
    return { tenantId: row.tenantId, context: JSON.parse(row.contextJson) as Record<string, unknown> };
  } catch {
    return { tenantId: row.tenantId, context: {} };
  }
}

/**
 * Provider callbacks can return without the SellerHisab session cookie even
 * though the OAuth state is still valid. The state itself is random, hashed at
 * rest, single-use, connector-bound and already carries the owning user/tenant.
 *
 * Callers MUST verify the provider callback signature/HMAC and required callback
 * parameters before calling this function.
 */
export async function consumeOauthStateForCallback(input: {
  connectorId: ApiConnectorId;
  state: string;
}): Promise<{ userId: string; tenantId: string; context: Record<string, unknown> } | null> {
  const stateHash = await sha256(input.state);
  const db = getD1();
  const row = await db.prepare(`
    SELECT id, user_id AS userId, tenant_id AS tenantId, context_json AS contextJson
    FROM connector_oauth_states
    WHERE state_hash = ?1 AND connector_id = ?2 AND expires_at > ?3
    LIMIT 1
  `).bind(stateHash, input.connectorId, Date.now()).first<{ id: string; userId: string; tenantId: string; contextJson: string }>();
  if (!row) return null;

  const deleted = await db.prepare(`
    DELETE FROM connector_oauth_states
    WHERE id = ?1 AND state_hash = ?2 AND connector_id = ?3
  `).bind(row.id, stateHash, input.connectorId).run();
  if ((deleted.meta?.changes ?? 0) !== 1) return null;

  try {
    return { userId: row.userId, tenantId: row.tenantId, context: JSON.parse(row.contextJson) as Record<string, unknown> };
  } catch {
    return { userId: row.userId, tenantId: row.tenantId, context: {} };
  }
}

export async function upsertConnectedAccount(input: {
  userId: string;
  tenantId: string;
  connectorId: ApiConnectorId;
  channelId: "amazon-in" | "flipkart" | "shopify" | "woocommerce";
  externalAccountId: string;
  displayName: string;
  mode: "oauth-api" | "seller-api";
  enabledCapabilities: string[];
  grantedScopes: string[];
  credential: StoredConnectorCredential;
}): Promise<OwnedConnection> {
  const authorization = await getD1().prepare(`
    SELECT CASE WHEN t.owner_user_id = ?1 THEN 'owner' ELSE tm.role END AS role
    FROM tenants t LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.user_id = ?1
    WHERE t.id = ?2 AND (t.owner_user_id = ?1 OR tm.user_id = ?1) LIMIT 1
  `).bind(input.userId, input.tenantId).first<{ role: string | null }>();
  if (!authorization || (authorization.role !== "owner" && authorization.role !== "admin")) {
    throw new Error("Workspace role no longer allows marketplace connection changes.");
  }
  const accountDigest = await sha256(`${input.tenantId}:${input.channelId}:${input.externalAccountId}`);
  const connectionDigest = await sha256(`${input.tenantId}:${input.connectorId}:${input.externalAccountId}`);
  const channelAccountId = `cha_${accountDigest.slice(0, 24)}`;
  const connectionId = `con_${connectionDigest.slice(0, 24)}`;
  const now = new Date().toISOString();
  const db = getD1();
  const key = currentConnectorKey();
  const encrypted = await encryptJson(input.credential, key.secret);

  // D1 batch keeps account, connection and encrypted credentials together. A
  // failed credential write must never leave a fake connected status behind.
  await db.batch([
    db.prepare(`
      INSERT INTO channel_accounts
        (id, tenant_id, channel_id, external_account_id, display_name, region, currency, status, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'IN', 'INR', 'active', ?6, ?6)
      ON CONFLICT(tenant_id, channel_id, region, external_account_id)
      DO UPDATE SET display_name = excluded.display_name, status = 'active', updated_at = excluded.updated_at
    `).bind(channelAccountId, input.tenantId, input.channelId, input.externalAccountId, input.displayName, now),
    db.prepare(`
      INSERT INTO connector_connections
        (id, tenant_id, channel_account_id, connector_id, mode, status, enabled_capabilities_json, granted_scopes_json, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'connected', ?6, ?7, ?8, ?8)
      ON CONFLICT(id) DO UPDATE SET
        channel_account_id = excluded.channel_account_id,
        mode = excluded.mode,
        status = 'connected',
        enabled_capabilities_json = excluded.enabled_capabilities_json,
        granted_scopes_json = excluded.granted_scopes_json,
        last_error_code = NULL,
        last_error_message = NULL,
        updated_at = excluded.updated_at
    `).bind(
      connectionId,
      input.tenantId,
      channelAccountId,
      input.connectorId,
      input.mode,
      JSON.stringify(input.enabledCapabilities),
      JSON.stringify(input.grantedScopes),
      now,
    ),
    db.prepare(`
      INSERT INTO connector_credentials
        (connection_id, encrypted_payload, iv, key_version, expires_at, refresh_expires_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
      ON CONFLICT(connection_id) DO UPDATE SET
        encrypted_payload = excluded.encrypted_payload,
        iv = excluded.iv,
        key_version = excluded.key_version,
        expires_at = excluded.expires_at,
        refresh_expires_at = excluded.refresh_expires_at,
        updated_at = excluded.updated_at
    `).bind(
      connectionId,
      encrypted.ciphertext,
      encrypted.iv,
      key.version,
      input.credential.accessExpiresAt ?? null,
      input.credential.refreshExpiresAt ?? null,
      now,
    ),
  ]);

  await writeConnectorAudit({
    tenantId: input.tenantId,
    userId: input.userId,
    action: "connector.connected",
    resourceId: connectionId,
    metadata: { connectorId: input.connectorId, channelId: input.channelId, mode: input.mode },
  });

  return {
    id: connectionId,
    tenantId: input.tenantId,
    channelAccountId,
    connectorId: input.connectorId,
    status: "connected",
    externalAccountId: input.externalAccountId,
    displayName: input.displayName,
  };
}

export async function storeCredential(connectionId: string, credential: StoredConnectorCredential): Promise<void> {
  const key = currentConnectorKey();
  const encrypted = await encryptJson(credential, key.secret);
  await getD1().prepare(`
    INSERT INTO connector_credentials
      (connection_id, encrypted_payload, iv, key_version, expires_at, refresh_expires_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    ON CONFLICT(connection_id) DO UPDATE SET
      encrypted_payload = excluded.encrypted_payload,
      iv = excluded.iv,
      key_version = excluded.key_version,
      expires_at = excluded.expires_at,
      refresh_expires_at = excluded.refresh_expires_at,
      updated_at = excluded.updated_at
  `).bind(
    connectionId,
    encrypted.ciphertext,
    encrypted.iv,
    key.version,
    credential.accessExpiresAt ?? null,
    credential.refreshExpiresAt ?? null,
    new Date().toISOString(),
  ).run();
}

export async function loadCredential(connectionId: string): Promise<StoredConnectorCredential> {
  const row = await getD1().prepare(`
    SELECT encrypted_payload AS encryptedPayload, iv, key_version AS keyVersion
    FROM connector_credentials
    WHERE connection_id = ?1
  `).bind(connectionId).first<{ encryptedPayload: string; iv: string; keyVersion: string }>();
  if (!row) throw new Error("Connector authorization is missing. Reconnect the marketplace.");
  const credential = await decryptJson<StoredConnectorCredential>(row.encryptedPayload, row.iv, connectorKeyForVersion(row.keyVersion));
  const current = currentConnectorKey();
  if (row.keyVersion !== current.version) await storeCredential(connectionId, credential);
  return credential;
}

export async function getConnectionById(connectionId: string): Promise<OwnedConnection | null> {
  const row = await getD1().prepare(`
    SELECT cc.id,
           cc.tenant_id AS tenantId,
           cc.channel_account_id AS channelAccountId,
           cc.connector_id AS connectorId,
           cc.status,
           ca.external_account_id AS externalAccountId,
           ca.display_name AS displayName
    FROM connector_connections cc
    LEFT JOIN channel_accounts ca ON ca.id = cc.channel_account_id
    WHERE cc.id = ?1
    LIMIT 1
  `).bind(connectionId).first<OwnedConnection>();
  if (!row) return null;
  if (!(["amazon-in-v1", "flipkart-v1", "shopify-v1", "woocommerce-v1"] as string[]).includes(row.connectorId)) return null;
  return row;
}

export async function getOwnedApiConnection(userId: string, connectorId: ApiConnectorId): Promise<OwnedConnection | null> {
  const tenantId = await findUserTenantId(userId);
  if (!tenantId) return null;
  const row = await getD1().prepare(`
    SELECT cc.id,
           cc.tenant_id AS tenantId,
           cc.channel_account_id AS channelAccountId,
           cc.connector_id AS connectorId,
           cc.status,
           ca.external_account_id AS externalAccountId,
           ca.display_name AS displayName
    FROM connector_connections cc
    LEFT JOIN channel_accounts ca ON ca.id = cc.channel_account_id
    WHERE cc.connector_id = ?2 AND cc.tenant_id = ?1
    ORDER BY cc.updated_at DESC
    LIMIT 1
  `).bind(tenantId, connectorId).first<OwnedConnection>();
  return row ?? null;
}

export async function disconnectOwnedConnection(userId: string, connectorId: ApiConnectorId): Promise<boolean> {
  const connection = await getOwnedApiConnection(userId, connectorId);
  if (!connection) return false;
  const db = getD1();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("DELETE FROM connector_credentials WHERE connection_id = ?1").bind(connection.id),
    db.prepare(`
      UPDATE connector_connections
      SET status = 'disabled', granted_scopes_json = '[]', last_error_code = NULL, last_error_message = NULL, updated_at = ?2
      WHERE id = ?1
    `).bind(connection.id, now),
  ]);
  await writeConnectorAudit({
    tenantId: connection.tenantId,
    userId,
    action: "connector.disconnected",
    resourceId: connection.id,
    metadata: { connectorId },
  });
  return true;
}

export async function markConnectionSync(input: {
  connectionId: string;
  status: "healthy" | "degraded";
  success?: boolean;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await getD1().prepare(`
    UPDATE connector_connections
    SET status = ?2,
        last_sync_at = ?3,
        last_success_at = CASE WHEN ?4 = 1 THEN ?3 ELSE last_success_at END,
        last_error_code = ?5,
        last_error_message = ?6,
        updated_at = ?3
    WHERE id = ?1
  `).bind(
    input.connectionId,
    input.status,
    now,
    input.success ? 1 : 0,
    input.errorCode ?? null,
    input.errorMessage?.slice(0, 300) ?? null,
  ).run();
}

export async function writeConnectorAudit(input: {
  tenantId: string;
  userId: string;
  action: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await getD1().prepare(`
    INSERT INTO audit_events (id, tenant_id, user_id, action, resource_type, resource_id, metadata_json, created_at)
    VALUES (?1, ?2, ?3, ?4, 'connector', ?5, ?6, ?7)
  `).bind(
    randomId("aud"),
    input.tenantId,
    input.userId,
    input.action,
    input.resourceId ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    new Date().toISOString(),
  ).run();
}
