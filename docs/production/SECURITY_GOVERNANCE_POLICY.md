# Security Governance Policy

## Purpose

This policy defines SellerHisab's security governance framework for handling marketplace seller data. It establishes roles, responsibilities, review cadences and controls that apply to personnel who access SellerHisab production systems, source code or seller data.

## Evidence rule and deployment status

Policy text describes required controls, but a policy document is not evidence that a provider/dashboard or endpoint control is enabled. Repository controls are considered implemented only when the code/configuration exists and validation passes. Production enforcement additionally requires the reviewed migration/deployment and operational verification.

The admin MFA/password controls associated with migration `0024_admin_security_controls.sql` are remediation-source controls until that migration and code are approved and deployed and active privileged admins complete enrollment. Cloudflare WAF/firewall/monitoring settings and workstation anti-malware remain external-verification items; see `NETWORK_SECURITY_RESPONSIBILITY.md`.

## Roles and responsibilities

| Role | Responsibility | Scope |
|---|---|---|
| **Security Owner** | Overall security posture, incident-response decisions, policy review approval, Amazon/marketplace notification obligations, vendor/security evidence oversight. | All environments |
| **Technical Lead** | Implements security controls, reviews code for vulnerabilities, manages CI/CD security gates, coordinates production secret rotation, reviews dependency advisories. | Source code + production application |
| **Operations Lead** | Reviews production Cloudflare configuration, access, monitoring, migrations/deployments and backup/restore procedures. | Production infrastructure |

Before Amazon re-application/launch approval, assign named individuals to each role and record backup contacts outside the public repository.

## Security controls summary

### Authentication and privileged access

- Seller login: password (PBKDF2-SHA256, production-compatible 100K-iteration v3 format) or verified mobile OTP flow.
- Privileged admin access: authenticated admin session plus RFC 6238 TOTP or a single-use recovery code and current admin password for step-up.
- Admin TOTP secrets: AES-GCM encrypted before D1 storage using domain-separated server-only key material; recovery codes are one-way hashed and single-use.
- TOTP replay prevention: a successfully consumed time step cannot be reused.
- Privileged step-up proof: HttpOnly + Secure + SameSite=Strict, bound to current session, current credential digest and security version; maximum lifetime 15 minutes.
- Central admin API gate: `/api/admin/*` is protected by privileged step-up except narrowly scoped MFA/step-up/password bootstrap endpoints required to establish or recover the security boundary.
- Password/MFA security changes increment the security version so stale privileged proofs stop authorizing admin operations.
- Session tokens: 32-byte random values, SHA-256 hashed with the session secret before storage; cookie is HttpOnly, Secure and SameSite=Lax.

### Admin password controls

- Minimum 12 characters with uppercase, lowercase, number and symbol.
- Minimum password age: 1 day.
- Maximum password age: 365 days.
- Reuse protection: current password plus the last 10 prior password hashes are rejected after the history control becomes active.
- Password history is prospective; the system cannot reconstruct passwords used before the history control existed.
- Durable lockout after 10 consecutive failed password attempts for a known account, with a 30-minute lockout period, in addition to request-rate limits.
- Historical retired v2/600K PBKDF2 credentials that exceed the Workers runtime limit require verified OTP reset into the supported current format.

### Authorization

- RBAC: Owner, Admin, Analyst and Viewer with explicit workspace capability gates.
- Tenant isolation: private marketplace/data operations bind access to the authenticated user's workspace/tenant ownership or membership.
- Platform admin allowlist: `ADMIN_EMAILS` and `ADMIN_PHONES`; production does not rely on the local-development fallback.

### Encryption

- Marketplace connector credentials: AES-GCM with random 12-byte IV, key material derived from a server-only secret and key-version support for rotation.
- Admin TOTP secret: encrypted using domain-separated key material rather than stored in plaintext.
- Transport: application uses HTTPS; Worker sets HSTS on HTTPS responses. Provider/TLS configuration outside source code must still be verified operationally.

### Rate limiting and abuse resistance

- Atomic D1-backed rate limits protect sensitive endpoints.
- Password login includes both IP-based and identity-specific request limits.
- Private account/admin mutations receive a centralized IP mutation limit.
- Admin step-up and admin credential changes have additional user-specific limits.
- Durable account lockout is separate from request throttling and survives across request-rate buckets.

### CSRF / request boundary

- State-changing requests are checked against the SellerHisab same-origin boundary.
- Sensitive responses use no-store cache controls where applicable.
- Worker applies security headers including CSP, HSTS, X-Content-Type-Options, X-Frame-Options and Referrer-Policy.

### Audit logging

- Authentication events: registration, login and password reset -> `audit_events`.
- Admin security events include MFA enrollment/rotation/verification, password lockout and admin password changes -> `audit_events`.
- Workspace events and other governed application actions use tenant/audit event records where implemented.
- Billing events use `billing_audit_events` and related durable receipts.

## Review cadence

| Review | Frequency | Owner | Deliverable |
|---|---|---|---|
| Security governance policy | Every 6 months | Security Owner | Updated policy + revision note |
| Incident response plan | Every 6 months | Security Owner | Reviewed `INCIDENT_RESPONSE.md` + sign-off |
| Access review | Quarterly | Security Owner | Signed access-review record |
| Security awareness training | Every 6 months | Security Owner | Attendance/completion evidence |
| Dependency/source security | Automated CI plus manual release review | Technical Lead | CI/advisory/secret-scan evidence |
| Tabletop drill | Quarterly | Security Owner + assigned roles | Attendance, scenario outcomes and corrective actions |
| Network/endpoint evidence | Before Amazon re-application and after material change | Security + Operations | Cloudflare/endpoint evidence record |

Templates are in `SECURITY_TRAINING_AND_REVIEW_EVIDENCE.md` and `ACCESS_REVIEW_PROCEDURE.md`. A blank template is not completion evidence.

## Access review procedure

Every quarter, the Security Owner reviews at minimum:

1. `ADMIN_EMAILS` / `ADMIN_PHONES`, active admin accounts, MFA enrollment and stale privileged sessions.
2. GitHub collaborators, privileges, branch/review controls and privileged-account MFA.
3. Cloudflare members, roles, API tokens, Worker bindings and account MFA.
4. Connected marketplace application scopes/credentials and stale seller connections.
5. Production secret inventory and key-rotation status without copying secret values into review records.
6. Findings from prior reviews and incidents.

Follow `ACCESS_REVIEW_PROCEDURE.md`; store signed records outside the public repository.

## Third-party / provider responsibility

| Provider | Purpose | Repository evidence | External evidence still required |
|---|---|---|---|
| Cloudflare | Workers, D1, R2, Queues, DNS/security edge | Runtime bindings, Worker application boundary | WAF/firewall, threat-detection/IDS-equivalent settings, members/MFA, token least privilege, production segmentation/boundaries |
| Razorpay | Payment processing | Signature verification and durable billing controls | Provider account access/MFA and dashboard configuration |
| MSG91 | Mobile OTP verification | Server-side verification flow | Provider account access/MFA and allowed-origin configuration |
| Amazon SP-API | Read-only marketplace sync | OAuth/token encryption, tenant scoping, connector implementation | Developer Profile approval, app scopes, privileged Amazon account MFA and external security evidence |
| Shopify / Flipkart / WooCommerce | Marketplace/store connections | Connector authorization/validation code | Provider console permissions and account security where applicable |

## Security training

All personnel with source or production access must review `AGENTS.md`, `INCIDENT_RESPONSE.md`, this policy and the Amazon data-handling policy before privileged work. A refresher is required every 6 months covering secure coding, secrets handling, phishing/social engineering, privileged MFA, incident response and Amazon's 24-hour incident-notification requirement. Actual completion must be recorded using real attendance evidence outside the public repository.

## Change management

1. Code changes go through repository validation/CI: source hygiene, production-source checks, typecheck, lint, unit tests, schema replay/parity, password runtime check, source-secret scan, dependency security check, compatibility check and build; browser E2E runs in the PR workflow.
2. CI has no production deploy or production migration step.
3. Production deployments and D1 migrations require explicit owner approval and separate execution.
4. Historical migrations are immutable; follow the repository migration rules in `AGENTS.md`.

## Compliance / claims discipline

| Topic | Status |
|---|---|
| Amazon SP-API Data Protection/security remediation | Source/process controls documented; production + external evidence must be verified before re-application |
| India DPDP / CERT-In | External legal review required; repository does not determine legal applicability/deadlines |
| SOC 2 / ISO 27001 | Not claimed |
| Cloudflare WAF/IDS/anti-malware/segmentation | Do not claim PASS until external evidence is reviewed |

## Revision history

- 2026-09-12: aligned policy wording with the actual remediation-source implementation; added evidence/deployment boundaries, password history/age/lockout, TOTP step-up and external-verification requirements.
- Next formal policy review: six months after owner approval of this revision.
