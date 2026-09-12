# Amazon SP-API Data Handling Policy

## Purpose

This policy governs how SellerHisab handles data obtained through Amazon Selling Partner API (SP-API). It applies to all SellerHisab personnel, systems and automated processes that access, store or process Amazon marketplace data.

## Data classification

### CONFIDENTIAL — Amazon API credentials

- LWA `client_id`, `client_secret`, `access_token`, `refresh_token`.
- Encrypted at rest with AES-GCM-256 using a server-only key (`CONNECTOR_ENCRYPTION_KEY`).
- Stored in `connector_credentials` table as encrypted payloads with random 12-byte IVs.
- Key versioning (v1/v2) supports rotation without re-authorization.
- Never logged, exported, included in error messages, displayed in UI, or committed to source control.
- Production secrets deployed exclusively via `wrangler secret put`; never in `.env`, scripts, chat or screenshots.

### RESTRICTED — Seller business data

- Order IDs, item quantities, amounts, fees, settlement identifiers, financial event groups.
- Obtained via SP-API Orders API and Finances API (read-only).
- Stored as **normalized, privacy-safe API observations** in the immutable commerce ledger within D1.
- Scoped to the seller's workspace (tenant); never visible to other tenants.
- Raw SP-API JSON response payloads are **not stored**.

### NOT COLLECTED — Customer PII

- SellerHisab **intentionally omits** customer names, emails, phone numbers and shipping addresses from all SP-API queries.
- API field selections exclude buyer PII by design.
- No buyer/customer PII is stored anywhere in the system.
- If Amazon changes API response shapes to include PII in previously PII-free fields, the normalization layer drops unrecognized personal fields.

## Data handling rules

1. **Read-only access** — SellerHisab requests only read scopes. No writes, repricing, listing changes, order modifications, advertising changes or fulfillment actions are performed through SP-API.
2. **Token lifecycle** — Tokens are refreshed automatically when they approach expiry (5-minute threshold). Old access tokens are overwritten, not accumulated. Refresh tokens are replaced when Amazon issues a new one.
3. **Encryption at rest** — All credentials are AES-GCM-256 encrypted before storage. The encryption key is derived via SHA-256 from a high-entropy server secret of at least 32 characters.
4. **Transport security** — All SP-API communication uses HTTPS (TLS 1.2+). HSTS is enforced with preload.
5. **No raw storage** — Raw Amazon API response bodies are never persisted. Only normalized, schema-validated observations are written to D1.
6. **Source control** — No Amazon credentials, tokens, seller IDs or order data appear in source code, Git history or CI logs. Gitleaks scans full Git history in CI.

## Data retention

| Data type | Retention | Deletion trigger |
|---|---|---|
| Amazon LWA tokens (encrypted) | While connection is active | Disconnect, account deletion, or key rotation |
| Normalized order/settlement observations | Per tenant policy (bounded to 100 analyses per user) | Account deletion cascade or manual data pruning |
| OAuth state tokens | 10-minute TTL | Automatic expiry cleanup |
| Audit events related to Amazon sync | 90 days for operational events; financial evidence retained per business policy | Operational retention job or account deletion |

## Data deletion

- **Seller disconnect:** Seller can disconnect Amazon at any time via `/app/connections`. All encrypted credentials for that connection are immediately deleted from D1. Normalized observations remain until the seller deletes their account or the data ages out.
- **Account deletion:** Cascades to all connected marketplace credentials, workspace data, audit events and commerce ledger entries via foreign key `ON DELETE CASCADE`.
- **Permanent deletion:** Encrypted credential rows are hard-deleted, not soft-deleted. There is no recycle bin or recovery period for revoked credentials.

## Incident notification

If Amazon SP-API data (credentials, order data, settlement data) is compromised or suspected compromised:

1. Notify Amazon at **`security@amazon.com` within 24 hours** of confirmed or suspected exposure.
2. Follow the Amazon-specific incident steps in `INCIDENT_RESPONSE.md`.
3. Include: incident description, data categories affected, estimated seller count, containment actions, remediation timeline, SellerHisab contact.
4. Immediately rotate the affected LWA client secret and connector encryption key.
5. Suspend SP-API sync for affected connections until key rotation is verified.
6. Preserve redacted evidence; never disclose raw tokens or seller data externally.

## Access control

- Only workspace members with appropriate RBAC roles (Owner, Admin, Analyst) can view API sync results.
- Admin access requires password + TOTP MFA step-up authentication.
- API credentials are never visible to any user or admin; only the encrypted ciphertext exists in D1.
- The Cloudflare Worker runtime decrypts credentials only at the moment of API call execution; decrypted values are never logged or cached.

## Review

- This policy is reviewed every **6 months** or immediately after any security incident involving Amazon data.
- Initial version. Next review: [date + 6 months from approval].
