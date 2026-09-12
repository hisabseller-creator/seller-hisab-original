# Amazon SP-API Data Handling Policy

## Purpose

This policy governs how SellerHisab handles data obtained through Amazon Selling Partner API (SP-API). It applies to SellerHisab personnel, systems and automated processes that access, store or process Amazon marketplace data.

## Evidence and deployment rule

Repository code/policy may prove that a control is designed and implemented in source. Production enforcement must be verified separately after the reviewed migration/deployment and required account configuration. External Cloudflare, endpoint and provider-account controls are not proven by this document.

## Data classification

### CONFIDENTIAL — Amazon API credentials

- LWA `client_id`, `client_secret`, `access_token`, `refresh_token`.
- Connector credential payloads are encrypted before D1 storage with AES-GCM using server-only key material.
- Stored in connector credential storage as encrypted ciphertext plus random IV and key version; raw tokens are not intended to be stored in plaintext.
- Key versioning (v1/v2) supports controlled rotation.
- Tokens/secrets must never be logged, exported to user-visible output, included in error messages, displayed in UI or committed to source control.
- Production secrets must be supplied through approved provider secret storage, not committed to `.env`, scripts, chat, tickets or screenshots.

### RESTRICTED — Seller business data

- Marketplace identifiers and normalized operational/financial observations required for SellerHisab calculations, such as order/settlement references, quantities, amounts and fee/financial-event information.
- Amazon access is intended to be read-only for the SellerHisab reporting/reconciliation use case.
- Persisted application data is tenant/workspace scoped.
- Raw Amazon API response bodies are not intended to be retained as long-lived application records; connector normalization stores the fields required by SellerHisab's governed data model.

### NOT INTENTIONALLY COLLECTED — Buyer/customer PII

- SellerHisab's Amazon connector is not designed to collect buyer names, personal email addresses, phone numbers or shipping addresses.
- Normalization should reject/drop fields outside the governed business-data model rather than persisting arbitrary response payloads.
- Any future Amazon scope or endpoint that introduces restricted buyer PII requires a fresh security/privacy review before use.

## Data handling rules

1. **Read-only application purpose** — SellerHisab uses Amazon data for seller reporting/reconciliation. Do not add listing, repricing, messaging, fulfillment or other write actions without a separate approved security/product review.
2. **Token lifecycle** — Access tokens are refreshed as required by the connector; replaced token state must not be accumulated unnecessarily.
3. **Encryption at rest** — Connector credentials are encrypted before persistence using the existing AES-GCM application encryption helper and versioned server-only key material.
4. **Transport security** — Amazon API communication must use HTTPS; SellerHisab's public production origin is HTTPS and Worker responses set HSTS on HTTPS traffic.
5. **No uncontrolled raw storage** — Do not persist arbitrary raw Amazon response bodies. Store only normalized/schema-governed observations needed by the product.
6. **Source control** — Amazon secrets/tokens and real seller data must never be committed. CI includes source-secret checks and full-history gitleaks scanning.
7. **Tenant boundary** — Amazon connection credentials and resulting private data must remain scoped to the authenticated seller workspace/tenant.

## Data retention and deletion

Retention must follow the application's approved retention/deletion behavior and the applicable Amazon policy. In particular:

| Data type | Intended lifecycle | Deletion trigger |
|---|---|---|
| Amazon LWA connector tokens | While the authorized connection is active and needed | Disconnect, account deletion, credential revocation/rotation as applicable |
| Normalized Amazon business observations | Only as required for the SellerHisab product/approved retention policy | Account/workspace deletion or governed retention/pruning process |
| OAuth state | Short-lived authorization transaction state | Expiry/cleanup after the authorization window |
| Operational audit/sync evidence | Per the approved operational/financial retention policy | Retention job or account/workspace lifecycle, subject to required retained evidence |

Do not state a numeric retention promise to Amazon unless it is verified against the deployed schema/jobs and approved business policy.

## Seller disconnect and account deletion

- A seller must be able to disconnect the Amazon connection through the supported connection workflow; connector credentials for that connection must no longer remain usable afterward.
- Account/workspace deletion must remove marketplace credentials and private tenant data according to the application's lifecycle implementation and foreign-key/deletion rules.
- Revoked credential material is not to be exposed through a recycle-bin/user recovery path.

## Incident notification

An **identified confirmed or suspected Amazon Information Security Incident** involving Amazon credentials/data starts the Amazon notification clock. SellerHisab must:

1. Notify Amazon at **`security@amazon.com` within 24 hours of identification** of the confirmed or suspected Amazon Information Security Incident.
2. Follow the Amazon-specific incident steps in `INCIDENT_RESPONSE.md`.
3. Provide factual incident scope available at the time, affected data categories/sellers where known, containment actions, remediation status/timeline and a SellerHisab contact.
4. Rotate/revoke affected Amazon and application credentials/keys as appropriate to the incident.
5. Suspend affected SP-API sync where continued operation could increase exposure until containment/rotation is verified.
6. Preserve redacted evidence without copying raw tokens or seller data into public or third-party communications.

## Access control

- Marketplace results are protected by authenticated workspace/tenant authorization.
- Privileged platform-admin source controls on the remediation branch implement password + TOTP/recovery-code step-up with a 15-minute maximum privileged-proof lifetime, durable password lockout and password lifecycle controls.
- Those admin controls become production evidence only after migration `0024_admin_security_controls.sql` is applied through the approved process, the matching code is deployed, and privileged admins enroll/verify MFA.
- API credential plaintext must not be exposed to platform users/admin UI; decryption is performed only inside trusted server-side connector execution when required for an API call.

## Review

- Review this policy every **6 months**, after a material Amazon connector/data-scope change, or immediately after an Amazon-related security incident.
- Record the reviewer, date, findings and next due date using restricted operational evidence; repository text alone is not proof that the review occurred.

## Related documents

- `INCIDENT_RESPONSE.md`
- `SECURITY_GOVERNANCE_POLICY.md`
- `ACCESS_REVIEW_PROCEDURE.md`
- `NETWORK_SECURITY_RESPONSIBILITY.md`
- `SECURITY_TRAINING_AND_REVIEW_EVIDENCE.md`
- `AMAZON_REAPPLICATION_CHECKLIST.md`
