-- Forward only. Apply separately with explicit production approval.
CREATE TABLE billing_event_jobs (
 event_id text PRIMARY KEY NOT NULL REFERENCES webhook_events(provider_event_id) ON DELETE CASCADE,
 payload_json text NOT NULL,
 state text NOT NULL DEFAULT 'queued',
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at text NOT NULL,
 lease_token text,
 lease_until text,
 error_code text,
 created_at text NOT NULL,
 updated_at text NOT NULL
);
CREATE INDEX billing_event_jobs_due_idx ON billing_event_jobs(state,next_attempt_at);
CREATE TABLE payment_intents (
 id text PRIMARY KEY NOT NULL,
 analysis_id text NOT NULL,
 product text NOT NULL,
 user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 amount_paise integer NOT NULL,
 currency text NOT NULL,
 state text NOT NULL DEFAULT 'creating',
 provider_order_id text,
 created_at text NOT NULL,
 updated_at text NOT NULL
);
CREATE UNIQUE INDEX payment_intents_purchase_unique ON payment_intents(analysis_id,product);
CREATE UNIQUE INDEX payment_intents_provider_unique ON payment_intents(provider_order_id);
ALTER TABLE payments ADD reconciliation_checked_at text;
ALTER TABLE subscriptions ADD reconciliation_checked_at text;
CREATE INDEX payments_reconciliation_due_idx ON payments(reconciliation_checked_at,id);
CREATE INDEX subscriptions_reconciliation_due_idx ON subscriptions(reconciliation_checked_at,id);
ALTER TABLE connector_sync_jobs ADD logical_key text;
CREATE UNIQUE INDEX connector_sync_jobs_logical_unique ON connector_sync_jobs(logical_key);
