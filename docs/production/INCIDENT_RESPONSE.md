# Incident Response

Severity examples:
- SEV-1: cross-tenant exposure, payment charged with systematic access loss, financial corruption across tenants, credential leak.
- SEV-2: connector/billing/import outage affecting a meaningful cohort with workaround unavailable.
- SEV-3: isolated failed import, UI regression, delayed sync with safe retry.

For every incident:
1. Stop or gate the harmful write path.
2. Preserve logs/evidence without raw secrets or full bank/marketplace rows.
3. Capture request/incident IDs, release version, tenant IDs only where operationally necessary.
4. Identify financial/data scope before repair.
5. Reconcile provider/payment state for billing incidents.
6. Notify affected customers with facts, impact, workaround and next update time.
7. Use forward fixes; never manually rewrite old migrations.
8. Complete a short post-incident root-cause and prevention note.

## F20 response ownership and scenarios

Assign incident commander, technical lead, finance lead, privacy/legal lead, customer communication lead and backup contacts before launch approval. Store contact numbers and provider support identifiers outside the public repository. The commander sets the next update time, records severity and owns closure; legal counsel decides applicable notification obligations.

| Scenario | Containment and recovery |
|---|---|
| Auth/admin compromise | Revoke affected sessions; disable compromised admin allowlist identity; rotate keys through approved provider controls; preserve redacted auth audit evidence; verify step-up and reset paths. |
| Webhook/provider outage | Keep signed D1 receipts; inspect oldest age and DLQ; recover provider health; replay by event ID with idempotency; reconcile uncertain purchase receipts before any new order. |
| Connector backlog | Inspect checkpoint progress/coverage and scope expiry; pause affected provider consumer if needed; restore credentials/quotas; resume jobs; keep finance results partial until exhaustion. |
| Bad migration | Stop dependent writes, preserve schema/migration list and backup; use a reviewed forward migration or approved Time Travel recovery; never rerun 0006/0007/0008/0015/0018. |
| Bad deploy | Record exact Worker version, route error rates and request IDs; approved rollback must retain new hash readers and compatible schema; replay queued jobs after recovery. |
| D1/R2 outage | Degrade readiness, stop unsafe financial writes, preserve outbox; restore dependencies and verify data/media integrity before reopening. |
| Credential rotation | Inventory active key versions and provider consumers; rotate with overlap where supported; verify decrypt/auth; revoke old secrets only after successful checks. |

Evidence log: UTC timeline, severity changes, redacted request/version IDs, affected categories/cohorts, controls applied, provider case numbers, retained evidence location and access log. Do not paste secrets/raw seller files into chat tickets or logs.

Customer update template: incident time, confirmed impact, affected operation, workaround, next update time, support contact. Breach notification decision record: facts known, categories, jurisdictions, counsel consulted, applicable obligation/deadline, responsible sender, approval and transmission evidence. DPDP and CERT-In applicability, deadlines, retention and log location are **external legal verification**, not determined here.

Within the owner-approved postmortem window: document trigger, blast radius, detection/recovery times, root causes, failed controls, corrective actions with owners/dates, and regression/drill evidence. Conduct a quarterly tabletop covering an admin compromise plus provider outage; record attendance and actual outcomes. Tabletop/VAPT performed in this task: NO.
