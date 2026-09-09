CREATE TABLE connector_notifications (
 id TEXT PRIMARY KEY NOT NULL,
 connection_id TEXT NOT NULL REFERENCES connector_connections(id) ON DELETE CASCADE,
 received_at TEXT NOT NULL,
 history_days INTEGER NOT NULL,
 job_id TEXT REFERENCES connector_sync_jobs(id) ON DELETE SET NULL,
 state TEXT NOT NULL DEFAULT 'queued',
 updated_at TEXT NOT NULL
);
CREATE INDEX connector_notifications_due_idx ON connector_notifications(state,received_at);
