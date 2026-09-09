# Backup / Restore Runbook

Initial targets:
- Billing/entitlement RPO: <= 1 hour through provider reconciliation/event evidence.
- User/workspace/manual normalized data RPO: <= 24 hours.
- Authentication/billing RTO: <= 4 hours.
- Full workspace RTO: <= 8 hours.

Before any production migration:
1. Export/backup the D1 database using the current supported Cloudflare method.
2. Store the artifact outside the repository; encrypt at rest and restrict access.
3. Record timestamp, D1 database ID, production Worker version and migration list.

Restore drill:
1. Restore into a non-production D1/test database.
2. Run integrity and foreign-key checks.
3. Validate representative user/session metadata, workspaces/roles, entitlements, connector metadata, bank/ads/inventory rows and action history.
4. Reconcile paid orders/subscriptions with Razorpay after restore.
5. If connector encryption keys were lost, require merchant reconnection; never invent credentials.

## F20 drill validation and evidence

Existing RTO/RPO targets above remain proposals until an owner approves and measures them. Do not interpret a local migration replay as a Time Travel restore drill.

Quarterly, an assigned operator records source D1 ID, Time Travel bookmark/timestamp, Worker version, available encryption-key versions and migration inventory. Consult the current official D1 Time Travel procedure before executing any restore: https://developers.cloudflare.com/d1/reference/time-travel/ . Confirm the destination and preserve an encrypted pre-restore export. Restore operations and production migration/deploy actions require explicit approval.

Run node scripts/verify-restore.mjs against a non-production restored SQLite artifact. The tool is read-only, checks integrity/FKs/tenant lineage and billing entitlement gaps, and outputs counts only. Capture its report in restricted incident storage alongside recovery start/end times, achieved RPO, expected fixture/customer counts and operator/reviewer signatures. Empty counts do not prove a complete restore; compare with the inventory captured before backup.

Before re-enabling writes: revoke sessions where compromise is suspected; pause Queue consumers; reconcile provider state and uncertain payment intents by receipt; replay retained verified events; restart checkpointed connectors; confirm R2 media and credential decryptability. Never re-create an uncertain provider order merely because local history was restored. A rollback to code that cannot read password v2 will lock out upgraded users; retain the v2 verifier in emergency rollback artifacts.

Drill record: date / operator / source bookmark / non-production destination / integrity evidence / billing reconciliation evidence / achieved RTO/RPO / unresolved gaps / follow-up owner. Actual drill executed in this task: NO.
