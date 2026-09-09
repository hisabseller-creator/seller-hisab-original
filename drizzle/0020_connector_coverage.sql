-- Forward only: durable page checkpoints and machine-readable coverage.
ALTER TABLE connector_sync_jobs ADD checkpoint_json text;
ALTER TABLE connector_sync_jobs ADD coverage_json text;
ALTER TABLE connector_sync_jobs ADD lease_token text;
ALTER TABLE connector_sync_runs ADD coverage_json text;
CREATE TABLE connector_page_receipts (
 id text PRIMARY KEY NOT NULL,
 job_id text NOT NULL REFERENCES connector_sync_jobs(id) ON DELETE CASCADE,
 page_key text NOT NULL,
 created_at text NOT NULL
);
CREATE UNIQUE INDEX connector_page_receipts_job_page_unique ON connector_page_receipts(job_id,page_key);
