# SellerHisab — Current Project State

Last updated: 2026-09-14

This file is the short current checkpoint for any coding agent working on SellerHisab. Repository evidence and the current branch always override stale chat history.

## Repository

- Repository: `hisabseller-creator/seller-hisab-original`
- Primary branch: `main`
- Current `main` checkpoint: `0a12c131d533e4e865e42dbaa8543d4383ff4bc4` (`Add Copilot continuity pointer`).
- Amazon remediation branch: `security/amazon-remediation-0024`.
- Draft pull request: `#19` — `Amazon SP-API security remediation: MFA, lockout, password lifecycle and evidence`.
- Production safety rule remains in force: do not deploy, modify production data, merge to `main`, or execute production migrations without separate explicit approval.

## Amazon SP-API security remediation status

**Repository/source remediation: COMPLETE.**

The source implementation, schema/migration work, focused security tests, policy corrections and repository evidence templates required by this workstream are implemented on the remediation branch.

### Implemented source controls

- True RFC 6238 TOTP MFA for privileged/admin access.
- MFA secret storage encrypted using the existing application encryption/key-versioning pattern.
- Recovery codes are shown once, stored as hashes and consumed once.
- TOTP replay prevention through last-consumed time-step tracking.
- Admin step-up requires password plus MFA/recovery code and is bound to the current session, credential hash and security version.
- Privileged proof expires after the configured short step-up window and becomes invalid after credential/security-state changes or logout/session removal.
- Durable failed-password tracking and account lockout after 10 failed attempts, while preserving the existing request/identity rate-limit layers.
- Admin password lifecycle controls: minimum 12-character policy at the password validator boundary, previous-password history for the last 10 changes, minimum password age of 24 hours and maximum password age of 365 days.
- MFA-protected admin password changes and security-version/session invalidation on sensitive credential changes.
- Admin UI boundary for MFA enrollment, one-time recovery-code display, expired-password handling and MFA step-up.
- Migration `drizzle/0024_admin_security_controls.sql` plus Drizzle/schema-governance updates.
- Existing Amazon connector behavior, tenant scoping and read-oriented sync semantics preserved.

### Governance/evidence completed in repository

- Amazon 24-hour security-incident notification language is represented in the incident-response procedure.
- Amazon data-handling policy is aligned to implemented application behavior without claiming unsupported certifications.
- Access-review procedure is present.
- Network/external-control responsibility document is present and explicitly separates repository evidence from provider/account/device controls.
- Security training/review evidence template is present without fabricating completed training.
- Amazon re-application checklist is present.
- Unsupported earlier statements that password-only step-up was true MFA were corrected by implementing actual TOTP MFA and aligning the policies to the implementation.

## Validation checkpoint

Full GitHub-hosted source gates passed on remediation commit `0e87c0e6992462ec4ab8a013a40b87a6dffae425` in workflow run `34703358445`:

- repository hygiene: PASS
- production source check: PASS
- SEO source check: PASS
- TypeScript typecheck: PASS
- ESLint: PASS (warnings only; zero errors)
- generated fixtures: PASS
- unit test suite: PASS — 84 files / 364 tests
- schema verification: PASS
- password runtime check: PASS
- source-secret check: PASS
- security check: PASS
- compatibility check: PASS
- production build: PASS
- performance budget: PASS
- SBOM generation: PASS
- gitleaks full-history scan: PASS
- Playwright browser E2E on Chromium + WebKit: PASS

Two CI regressions discovered during finalization were fixed rather than bypassed:

1. The legacy admin step-up test was updated to exercise the new MFA-enabled security boundary instead of expecting password-only privileged access.
2. `db/schema-security.ts` now uses the explicit `.ts` ESM import required by the schema verification runtime.

## Migration checkpoint

- `drizzle/0023_connector_live_platform.sql` remains intact.
- New security migration is exactly `drizzle/0024_admin_security_controls.sql`.
- Migration 0024 has **not** been applied to production.
- Do not apply it remotely until the release/deployment step is explicitly approved.

## External verification still required before Amazon re-application

These are operational/account/device controls and are not provable from repository code alone. They are **not source-development gaps** and must remain marked `EXTERNAL VERIFICATION REQUIRED` until actual evidence is collected:

- Cloudflare account-level WAF/firewall rules actually enabled for the production zone/account.
- Endpoint anti-malware/OS-security controls on administrative devices.
- Completed access-review and security-training records according to the documented cadence.
- Incident-response review/approval evidence according to the documented six-month cadence.

**Note:** Cloudflare True Network IDS is explicitly NOT available on the current free plan, and this must be answered truthfully on the Amazon re-application (WAF provides L7 IPS). Network segmentation is COMPLETE via Cloudflare Service Binding.

Do not answer Amazon security-profile questions `Yes` solely because a policy document exists. A `Yes` requires the control to be actually implemented and evidenced.

## Release status

- Repository-side Amazon network security remediation: **COMPLETE**.
- Feature branch pushed: `security/amazon-network-hardening-20260914`.
- Cloudflare Amazon internal Worker deployed: **YES** (`sellerhisab-amazon-connector`).
- Cloudflare Amazon internal D1 created/migrated: **YES** (`3237f0c1-f008-4e4e-8ccb-297c30896a51`).
- Public Worker Service Binding deployed: **YES**.
- Amazon Developer Profile re-application: **NOT YET**; remaining endpoint/governance evidence required.

## Preserve

- Existing multi-tenant/tenant-scoped access controls.
- Existing connector encryption/key-versioning patterns.
- Existing CSRF, SSRF, rate-limit, session, webhook and payment-verification controls.
- Existing financial evidence/confidence semantics.
- Existing Amazon connector architecture unless a concrete reviewed security gap requires a narrowly scoped change.

## End-of-session handoff

The repository remediation workstream is source-complete. The next distinct phase is release/operations: review PR #19, collect external security evidence, then separately approve merge, production migration/deploy and Amazon re-application. Do not collapse those operational approvals into this source-completion checkpoint.
