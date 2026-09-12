# SellerHisab — Current Project State

Last updated: 2026-09-12

This file is the short current checkpoint for any coding agent working on SellerHisab. Repository evidence and the current branch always override stale chat history.

## Repository

- Repository: `hisabseller-creator/seller-hisab-original`
- Primary branch: `main`
- Amazon remediation branch: `security/amazon-remediation-0024`.
- PR `#19` — `Amazon SP-API security remediation: MFA, lockout, password lifecycle and evidence` — has been merged to `main`.
- Production application release commit: `507e5d5cfbc34a01f8a0363b3ba00fe86b1a56c2` (`Merge Amazon SP-API security remediation`).
- Production Worker version: `b9894ccb-2349-49de-8d04-19a620dfca21`.
- Production domain: `https://sellerhisab.com`.

## Amazon SP-API security remediation status

**Repository/source remediation: COMPLETE.**

The source implementation, schema/migration work, focused security tests, policy corrections and repository evidence templates required by this workstream are complete and merged to `main`.

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

Full GitHub-hosted source gates passed on remediation branch head `770e9e747f5503ac1ed8af029fd5dd9738579326` in workflow run `34703808959`:

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
2. `db/schema-security.ts` uses the explicit `.ts` ESM import required by the schema verification runtime.

## Production deployment checkpoint

- PR #19 merged to `main`: **YES**.
- Production application release commit: `507e5d5cfbc34a01f8a0363b3ba00fe86b1a56c2`.
- `drizzle/0023_connector_live_platform.sql`: preserved/intact.
- `drizzle/0024_admin_security_controls.sql`: **APPLIED TO PRODUCTION**.
- Production D1 database: `seller-margin-guard` (`220bab03-28c2-40c6-8f5a-7010c49ca21b`).
- Production verification confirmed these security tables exist: `admin_mfa_settings`, `admin_mfa_recovery_codes`, `user_security_state`, `user_password_history`.
- Cloudflare Worker `seller-margin-guard`: **DEPLOYED**.
- Worker version: `b9894ccb-2349-49de-8d04-19a620dfca21`.
- `https://sellerhisab.com/`: HTTP 200 after deployment.
- `https://sellerhisab.com/api/health`: HTTP 200 with `{"status":"ok"}` after deployment.
- The initial smoke-test script stopped only because PowerShell treats `$home` and built-in read-only `$HOME` as the same variable; deployment and migration had already succeeded. A corrected verification using different variable names subsequently passed both live checks.

## External verification still required before Amazon re-application

These are operational/account/device controls and are not provable from repository code alone. They are **not source-development gaps** and must remain marked `EXTERNAL VERIFICATION REQUIRED` until actual evidence is collected:

- Enroll and verify TOTP MFA on the real production admin account; securely retain one-time recovery codes.
- Cloudflare account-level WAF/firewall rules and equivalent threat-detection controls actually enabled for the production zone/account.
- Network/administrative segmentation and access-control evidence at the provider/account level where applicable.
- Endpoint anti-malware/OS-security controls on administrative devices.
- MFA and access-control evidence for relevant external administrative accounts.
- Completed access-review and security-training records according to the documented cadence.
- Incident-response review/approval evidence according to the documented six-month cadence.

Do not answer Amazon security-profile questions `Yes` solely because a policy document exists. A `Yes` requires the control to be actually implemented and evidenced.

## Release status

- Repository-side Amazon security remediation: **COMPLETE**.
- Merge to `main`: **COMPLETE**.
- Production migration 0024: **COMPLETE**.
- Production deployment: **COMPLETE**.
- Live homepage/health verification: **PASS**.
- Production admin TOTP enrollment/evidence: **NEXT**.
- Amazon Developer Profile re-application: **NOT YET**; complete the external operational evidence above first.

## Preserve

- Existing multi-tenant/tenant-scoped access controls.
- Existing connector encryption/key-versioning patterns.
- Existing CSRF, SSRF, rate-limit, session, webhook and payment-verification controls.
- Existing financial evidence/confidence semantics.
- Existing Amazon connector architecture unless a concrete reviewed security gap requires a narrowly scoped change.

## End-of-session handoff

Source remediation, merge, migration and production deployment are complete and live-verified. The next distinct phase is operational evidence collection: enroll production admin TOTP MFA, collect account/network/device/access/training/incident-response evidence, then update the Amazon Developer Profile and submit a new re-application/case. Do not recreate or reapply migration 0024 and do not redeploy merely to collect evidence unless a concrete defect is found.
