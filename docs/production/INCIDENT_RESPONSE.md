# Incident Response

## Severity examples

- SEV-1: cross-tenant exposure, credential compromise, material Amazon/marketplace data exposure, systemic financial corruption or other high-impact confidentiality/integrity incident.
- SEV-2: connector/billing/import outage affecting a meaningful cohort with no safe workaround, significant privileged-access anomaly or security control failure without confirmed material exposure.
- SEV-3: isolated failed import, UI regression or delayed sync with a safe retry/workaround.

## Required response for every incident

1. Assign an incident commander and severity.
2. Stop, isolate or gate the harmful path without destroying evidence.
3. Preserve logs/evidence without raw secrets or full seller/bank/marketplace payloads.
4. Capture request/incident IDs, release version and only the tenant/account identifiers operationally necessary.
5. Determine affected systems, data categories, tenants/sellers and time window.
6. Rotate/revoke compromised credentials and sessions as appropriate.
7. Reconcile provider/payment state for billing incidents before declaring recovery.
8. Communicate facts, known impact, workaround and next update time to affected customers when required.
9. Use reviewed forward fixes; never manually rewrite/rerun historical migrations contrary to `AGENTS.md`.
10. Complete a post-incident root-cause/prevention record with owners and due dates.

## Response ownership

Before launch/Amazon re-application approval, assign named people and backups for:

- Incident Commander / Security Owner
- Technical Lead
- Operations Lead
- Privacy/legal decision owner
- Customer communication owner

Store personal contact numbers, provider support identifiers and escalation contacts outside the public repository.

The Incident Commander records identification time, severity changes, containment decisions, notification deadlines and closure. Legal/privacy counsel or the assigned decision owner determines statutory notification obligations; repository documentation does not replace legal advice.

## Scenario playbook

| Scenario | Containment and recovery |
|---|---|
| Admin/account compromise | Revoke affected sessions, disable compromised privileged identity, rotate relevant credentials, preserve redacted auth/security audit evidence, verify MFA/password recovery before reopening. |
| Amazon/LWA token exposure | Suspend affected Amazon sync where needed, rotate/revoke affected Amazon/application credentials, determine seller/data scope, preserve evidence and start the Amazon 24-hour notification workflow immediately. |
| Webhook/provider outage | Keep signed/durable receipts, inspect backlog/DLQ, recover provider health, replay idempotently and reconcile uncertain financial state. |
| Connector backlog | Inspect checkpoint/coverage and credential/quota state, pause affected consumer if necessary, restore provider health and resume without presenting incomplete finance data as complete. |
| Bad migration | Stop dependent writes, preserve schema/migration evidence and backup, use a reviewed forward migration or approved provider recovery; never manually rerun protected historical migrations. |
| Bad deploy | Record exact Worker release/version and request IDs, perform an approved compatible rollback/forward fix, then verify queued jobs and schema compatibility. |
| D1/R2/Queues outage | Degrade readiness, stop unsafe financial writes, preserve durable work where possible, restore dependencies and verify data integrity before reopening. |
| Encryption-key compromise | Inventory active key versions/connections, rotate with overlap where supported, re-encrypt/re-authorize as needed, revoke the old key only after verification. |

## Evidence log

Record in UTC:

- identification/detection time;
- incident/severity changes;
- incident commander and participating roles;
- affected systems/data categories/cohorts;
- redacted request/release IDs;
- containment/recovery actions and timestamps;
- credential/session/key rotations;
- provider case/notification reference numbers;
- customer notification decisions;
- evidence location/access record;
- final root cause and corrective actions.

Never paste secret values, raw marketplace tokens, recovery codes or full seller files into chat, public tickets or public repositories.

## Amazon SP-API Information Security Incident notification

An Amazon notification is not delayed until the investigation is complete. When SellerHisab **identifies a confirmed or suspected Amazon Information Security Incident** involving Amazon credentials/data, the Incident Commander must treat that identification time as the notification-clock start.

1. Notify Amazon at **`security@amazon.com` within 24 hours of identification**.
2. Send the facts known at that time: incident description, affected Amazon data categories/seller scope where known, containment actions, current remediation status/timeline and SellerHisab follow-up contact.
3. If facts are still developing, state that explicitly and provide follow-up updates rather than waiting past the deadline for certainty.
4. Rotate/revoke affected Amazon LWA credentials and SellerHisab connector-encryption/session material as appropriate to the incident.
5. Suspend affected SP-API sync when continued operation could increase exposure or interfere with containment.
6. Preserve Amazon-related evidence in restricted storage and reference it from the general incident record without exposing tokens/seller data.
7. Customer/seller notification decisions must be tracked separately from the Amazon notification requirement.

| Amazon scenario | Minimum immediate action |
|---|---|
| LWA client/access/refresh token suspected exposed | Start 24-hour Amazon notification workflow; rotate/revoke applicable credentials; suspend/re-authorize affected connections as needed; determine seller/data scope. |
| Unauthorized Amazon order/finance data access | Gate affected access path/tenant, preserve audit evidence, start Amazon notification workflow, determine blast radius and customer-notification need. |
| Connector encryption key suspected compromised | Rotate to approved new key version, re-encrypt/re-authorize affected credentials, audit impacted connections and notify Amazon within 24 hours when Amazon data/credentials may have been at risk. |

## Customer update template

Record: incident time, confirmed impact, affected operation, current workaround, next update time and support contact. Do not speculate. A breach/legal notification decision record should capture facts known, categories, jurisdictions, responsible approver, deadline decision and transmission evidence. DPDP/CERT-In applicability and statutory deadlines require external legal verification.

## Post-incident and drill requirements

For material incidents, document trigger, blast radius, detection/containment/recovery times, root causes, failed controls, corrective actions with owners/dates and regression/drill evidence.

Conduct a quarterly tabletop covering at least an admin compromise and a provider/Amazon credential or outage scenario. Record actual attendance and outcomes using `SECURITY_TRAINING_AND_REVIEW_EVIDENCE.md`.

**Repository status:** the playbook is defined here; repository code does not prove that a tabletop, notification or external provider review has actually occurred.

## Review schedule

- Incident response plan: every 6 months and after any SEV-1/SEV-2 incident.
- Security governance policy: every 6 months.
- Access review: quarterly.
- Tabletop drill: quarterly.
- Network/endpoint evidence review: before Amazon re-application and after material infrastructure/access changes.

Record each completed review date, reviewer, findings, approval and next due date outside the public repository.
