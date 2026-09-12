# Security Governance Policy

## Purpose

This policy defines SellerHisab's security governance framework for handling marketplace seller data. It establishes roles, responsibilities, review cadences and controls that apply to all personnel who access SellerHisab production systems, source code or seller data.

## Roles and responsibilities

| Role | Responsibility | Scope |
|---|---|---|
| **Security Owner** | Overall security posture, incident response decisions, policy review approval, Amazon/marketplace notification obligations, vendor DPA oversight. | All environments |
| **Technical Lead** | Implements security controls, reviews code for vulnerabilities, manages CI/CD security gates, rotates production secrets, reviews dependency advisories. | Source code + production |
| **Operations Lead** | Monitors production alerts, manages Cloudflare configuration (WAF, DNS, Workers), executes approved migrations and deployments, manages backup/restore. | Production infrastructure |

Before launch, assign named individuals to each role and record backup contacts outside the public repository.

## Security controls summary

### Authentication
- Seller login: password (PBKDF2-SHA256, 100K iterations) or mobile OTP (MSG91 widget).
- Admin login: password + TOTP MFA second factor (RFC 6238).
- Admin step-up: required for all admin mutations; 10-minute TTL; bound to session + credential.
- Session tokens: 32-byte random, SHA-256 hashed before storage; HttpOnly, Secure, SameSite=Lax cookies.
- Admin password policy: minimum 12 characters, requires upper + lower + digit + symbol.

### Authorization
- RBAC: Owner, Admin, Analyst, Viewer with explicit `canWorkspace` capability gates.
- Tenant isolation: every database query binds to the session's active tenant ID.
- Admin allowlist: `ADMIN_EMAILS` + `ADMIN_PHONES` environment variables; empty list disallows admin access in production.

### Encryption
- Connector credentials (Amazon, Shopify, Flipkart, WooCommerce): AES-GCM-256 with 12-byte random IV, key derived from SHA-256 of server-only secret.
- Key versioning: v1/v2 rotation support without re-authorization.
- Transport: HTTPS with TLS 1.2+ enforced by Cloudflare; HSTS max-age=63072000, includeSubDomains, preload.

### Rate limiting
- Atomic D1-based rate limits on all sensitive endpoints (auth, admin, payments, contact, connectors).
- IP-based global limits + identity-specific limits per endpoint.
- Login: 60 attempts per IP per 15 minutes; 10 per identity per 15 minutes.
- Admin step-up: 5 attempts per user per 15 minutes.

### CSRF / SSRF
- CSRF: sec-fetch-site + origin header validation on all state-changing requests.
- SSRF: DNS resolution validation against private/reserved IP ranges for external API connections.

### Audit logging
- Authentication events: login, register, password reset → `audit_events` table.
- Workspace events: member changes, role changes, connection changes → `audit_events` table.
- Billing events: payment verification, subscription changes → `billing_audit_events` table.
- SEO governance changes: revision CAS with impact diff → `audit_events` table.

## Review cadence

| Review | Frequency | Owner | Deliverable |
|---|---|---|---|
| Security governance policy | Every 6 months | Security Owner | Updated policy + revision note |
| Incident response plan | Every 6 months | Security Owner | Updated INCIDENT_RESPONSE.md |
| Access review | Quarterly | Security Owner | Reviewed access list + changes recorded |
| Dependency audit | Weekly (automated via Dependabot) + manual before each release | Technical Lead | Advisory check evidence |
| Tabletop drill | Quarterly | Security Owner + all roles | Attendance + scenario outcomes log |
| Source secret scan | Every CI run (gitleaks full history) + local scan before commit | Technical Lead | CI pass evidence |

## Access review procedure

Every quarter, the Security Owner reviews:

1. `ADMIN_EMAILS` and `ADMIN_PHONES` — remove any identity no longer needing admin access.
2. Cloudflare dashboard access — verify only authorized personnel have account access.
3. Connected marketplace API credentials — verify all active connections are authorized by current sellers.
4. Active sessions — review session counts per admin user; revoke stale sessions.
5. Wrangler secret inventory — verify encryption keys, API keys and webhook secrets are current.

Record the review date, reviewer identity and any changes made. Store the review record outside the public repository.

## Third-party / vendor security

| Vendor | Purpose | Data shared | Security posture |
|---|---|---|---|
| Cloudflare | Infrastructure (Workers, D1, R2, Queues, DNS) | All application data (encrypted at rest by Cloudflare) | DPA required before production |
| Razorpay | Payment processing | Payment amounts, order IDs, subscription IDs | PCI DSS compliant; webhook signature verification |
| MSG91 | Mobile OTP delivery | Phone number only | No seller business data shared |
| Amazon SP-API | Marketplace data read | OAuth credentials (encrypted); read-only order/finance queries | See AMAZON_DATA_HANDLING_POLICY.md |
| Shopify | Marketplace data read | OAuth credentials (encrypted); read-only order queries | HMAC callback verification |
| Flipkart | Marketplace data read | OAuth credentials (encrypted); read-only order queries | Notification signing verification |

## Security training

- All developers must review `AGENTS.md`, `INCIDENT_RESPONSE.md` and this policy before contributing code.
- Security awareness refresher every 6 months, covering: secure coding, secrets handling, incident response, Amazon data obligations.
- Record training completion dates and attendees outside the public repository.

## Change management

1. All code changes go through CI (typecheck, lint, unit/contract/golden tests, source secret scan, gitleaks, dependency advisory check, build, performance budget).
2. Production deployments require explicit owner approval. The CI workflow has no deploy or migration step.
3. D1 migrations are never auto-applied to production; each migration requires separate authorized review.
4. Historical migrations (0006, 0007, 0008, 0015, 0018) are never manually rerun.

## Compliance

| Framework | Status |
|---|---|
| Amazon SP-API Data Protection Policy | AMAZON_DATA_HANDLING_POLICY.md; 24h notification to `security@amazon.com` |
| India DPDP Act | External legal review required before commencement |
| CERT-In | External legal verification of applicability and deadlines |
| SOC 2 / ISO 27001 | Not claimed; not currently pursued |

## Revision history

- Initial version. Next review: [date + 6 months from approval].
