# SellerHisab — Current Project State

Last reconstructed: 2026-09-12

This file is the short, current checkpoint for any coding agent working on SellerHisab. The repository and current branch always override stale chat history.

## Repository

- Repository: `hisabseller-creator/seller-hisab-original`
- Primary branch: `main`
- Last verified main checkpoint before this continuity file was added: `59dfb9cba08132cf53c9dbc4612a4f9ce9563a58` (`Add Amazon SP-API security governance documentation`).
- Production safety rule: do not deploy, modify production data, or execute production migrations without separate explicit approval.

## Current workstream

Amazon SP-API Developer Profile security remediation.

### Completed

- Amazon SP-API/LWA connector architecture already exists with encrypted connector credentials, callback/state handling, token refresh, read-oriented sync and tenant scoping.
- Amazon Phase 1A governance documentation was committed on `main` in `59dfb9c`:
  - `docs/production/INCIDENT_RESPONSE.md`
  - `docs/production/AMAZON_DATA_HANDLING_POLICY.md`
  - `docs/production/SECURITY_GOVERNANCE_POLICY.md`
  - `docs/production/ACCESS_REVIEW_PROCEDURE.md`
- Hosted GitHub Actions production source gates were successfully executed in run `34680928859` on commit `6a75427068b86b342735ae94b6eb6a3644664293`.

### Important correction to Phase 1A docs

The current Phase 1A policies contain present-tense statements that admin TOTP MFA is already enforced. Repository code does **not** currently implement true TOTP/FIDO2 MFA. Existing `server/admin-step-up.ts` is password/session re-authentication and must not be represented as a second factor. Correct these policy claims before Amazon re-application.

## Remaining Amazon security source work

Status is based on current repository code, not intended future design.

- True TOTP/FIDO2 MFA for privileged/admin access: **MISSING**.
- Persistent account lockout after repeated failed password attempts: **MISSING**; current login protection is rate limiting only.
- Password history (last 10): **MISSING**.
- Minimum password age (1 day): **MISSING**.
- Maximum password age (365 days): **MISSING**.
- Privileged/admin idle-session timeout: **MISSING**.
- Network security policy documenting Cloudflare responsibility boundaries: **MISSING**.
- Security training/review evidence template: **MISSING**.
- Cloudflare WAF/IDS/IPS/account-level controls remain **EXTERNAL VERIFICATION REQUIRED** and must not be claimed from repository code alone.

## Migration checkpoint

- `drizzle/0023_connector_live_platform.sql` already exists.
- The next new migration number is **0024**.
- Do not create another `0023` migration.
- Do not execute 0024 or any other migration against production without separate approval.

## Current task

Implement the remaining repository-level Amazon security remediation without unrelated redesign:

1. Correct unsupported TOTP/MFA claims in current policy docs.
2. Implement true privileged/admin TOTP MFA with encrypted secret storage, hashed single-use recovery codes, rate limiting and audit events.
3. Implement durable failed-login lockout while preserving existing IP/identity rate limits and non-enumerating login responses.
4. Implement applicable password history/age controls without breaking legacy password verification/reset behavior.
5. Add privileged-session idle protection and invalidate stale privileged/MFA state after credential/security changes.
6. Add migration `0024_...`, focused tests, network-security documentation and security-training/review template.
7. Run repository CI/tests before considering merge/release.

## Preserve

- Existing multi-tenant/tenant-scoped access controls.
- Existing connector encryption/key-versioning patterns.
- Existing CSRF, SSRF, rate-limit, session, webhook and payment verification controls.
- Existing financial evidence/confidence semantics.
- Existing Amazon connector architecture unless a concrete security gap requires a narrowly scoped change.

## Do not do

- Do not deploy.
- Do not run production migrations.
- Do not expose or commit credentials/secrets.
- Do not claim WAF, IDS/IPS, anti-malware, VAPT, training completion, certifications or external account controls without evidence.
- Do not mark Amazon re-application ready until source controls plus required external evidence are actually complete.

## End-of-session handoff

Every agent should update this file to the new current checkpoint and append a concise entry to `docs/AI_WORKLOG.md` with changed files, tests actually run, commit/push/deploy status, unresolved items and the next action.
