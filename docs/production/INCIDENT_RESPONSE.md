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

## Amazon SP-API data incident notification

If any incident involves Amazon SP-API data (seller orders, settlements, financial events, API credentials), the following additional steps apply:

1. Notify Amazon at `security@amazon.com` **within 24 hours** of confirmed exposure, per the Amazon SP-API Acceptable Use Policy and Data Protection Policy.
2. Include in the notification: incident description, categories of data affected, estimated number of affected sellers, containment actions taken, remediation timeline and SellerHisab contact for follow-up.
3. Immediately rotate the affected Amazon LWA client secret and connector encryption key. Revoke and re-encrypt all affected Amazon refresh tokens.
4. Suspend automatic SP-API sync for affected connections until the encryption key rotation is verified and Amazon acknowledges the notification.
5. Preserve redacted evidence of the Amazon-related portion separately from general incident evidence, referencing Amazon's data handling requirements.
6. Do not disclose raw Amazon API tokens, seller IDs or order data in any public or third-party incident communication.

| Amazon data scenario | Containment |
|---|---|
| LWA token exposure | Rotate LWA client secret via Amazon Developer Console; rotate CONNECTOR_ENCRYPTION_KEY; re-encrypt all connector credentials; revoke and reauthorize affected seller connections; notify `security@amazon.com` within 24h. |
| Unauthorized Amazon order data access | Gate affected tenant; preserve audit evidence; determine blast radius from audit_events; notify `security@amazon.com` within 24h; notify affected sellers. |
| Connector encryption key leak | Rotate to CONNECTOR_ENCRYPTION_KEY_V2; re-encrypt all credentials; verify decrypt; revoke old key; audit all connections; notify `security@amazon.com` if Amazon data was at risk. |

## Review schedule

- **Incident response plan review:** every 6 months, or immediately after any SEV-1/SEV-2 incident.
- **Security governance review:** every 6 months (see SECURITY_GOVERNANCE_POLICY.md).
- **Access review:** quarterly (see SECURITY_GOVERNANCE_POLICY.md).
- **Tabletop drill:** quarterly, covering at least one admin-compromise and one provider-outage scenario.
- Record review date, reviewer, findings and any policy changes in this document's revision history.
