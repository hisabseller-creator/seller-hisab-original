-- Amazon connector isolated D1 schema.
-- This database is bound ONLY to the internal Amazon connector Worker.
-- The public SellerHisab Worker has NO direct access to this database.

CREATE TABLE IF NOT EXISTS amazon_channel_accounts (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  channel_id    TEXT NOT NULL DEFAULT 'amazon-in',
  external_account_id TEXT NOT NULL,
  display_name  TEXT,
  region        TEXT NOT NULL DEFAULT 'IN',
  currency      TEXT NOT NULL DEFAULT 'INR',
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_amazon_channel_accounts_tenant_ext
  ON amazon_channel_accounts (tenant_id, channel_id, region, external_account_id);

CREATE TABLE IF NOT EXISTS amazon_connector_connections (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  channel_account_id TEXT NOT NULL REFERENCES amazon_channel_accounts(id),
  connector_id      TEXT NOT NULL DEFAULT 'amazon-in-v1',
  mode              TEXT NOT NULL DEFAULT 'oauth-api',
  status            TEXT NOT NULL DEFAULT 'pending',
  last_error_code   TEXT,
  last_error_message TEXT,
  last_sync_at      TEXT,
  sync_cursor_json  TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS amazon_connector_credentials (
  connection_id      TEXT PRIMARY KEY REFERENCES amazon_connector_connections(id),
  encrypted_payload  TEXT NOT NULL,
  iv                 TEXT NOT NULL,
  key_version        TEXT NOT NULL DEFAULT 'v1',
  expires_at         INTEGER,
  refresh_expires_at INTEGER,
  updated_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS amazon_connector_audit (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  user_id       TEXT,
  action        TEXT NOT NULL,
  resource_id   TEXT,
  metadata_json TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_amazon_audit_tenant_created
  ON amazon_connector_audit (tenant_id, created_at);
