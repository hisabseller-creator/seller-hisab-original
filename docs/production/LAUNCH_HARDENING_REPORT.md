# SellerHisab Launch Hardening Report — RC1

Status: **code hardening candidate; not yet production-deployed**.

This release addresses the highest-risk findings from the 4 September 2026 production-readiness audit. Production deployment and remote D1 migration are intentionally excluded from this package.

## Implemented in RC1

- Durable billing/webhook state fields and billing audit tables via new migration `0015_launch_hardening.sql`.
- Razorpay server-side verification helpers and entitlement/reconciliation groundwork.
- Subscription plan verification/cancellation lifecycle groundwork and centralized server-side plan capability checks.
- Deterministic India-safe financial date parsing; ambiguous raw platform dates fail closed.
- Viewer write restrictions and stronger workspace/action transition enforcement.
- Atomic D1 rate-limit update path.
- Flipkart token exchange moved away from URL-query secret transport.
- Production callback HTTPS restrictions and WooCommerce SSRF guard helpers.
- Connector correction/revision and retry-job infrastructure.
- Cash matching hardening, coverage-aware missing-payment handling, and read-only GET behavior.
- Import lifecycle/revision metadata for bank, ads and inventory normalized data.
- Multi-SKU / unallocated-ad safeguards in financial truth paths.
- Data export/deletion lifecycle groundwork and deletion receipts.
- Support triage/admin operations groundwork.
- Privacy copy corrections and benchmark-publication guardrails.
- File/ZIP parser hardening and stricter money parsing.
- CMS sanitizer hardening, health endpoint, release/request observability hooks.
- Same-tenant database triggers for sensitive relationships.

## Verification completed in build environment

- Migration chain `0000` through `0015` applied successfully to a clean SQLite/D1-compatible database.
- `PRAGMA integrity_check`: `ok`.
- `PRAGMA foreign_key_check`: no violations.
- Resulting schema: 49 application tables, 98 indexes, 17 triggers.
- Release payload is hash-manifested and contains no `.env*`, `.dev.vars`, local DB, build output, `node_modules`, `.git`, or historical backup folders.

## Verification still required on the real repository

The package runner must pass on the user's Windows repository before any deployment:

1. `pnpm install --frozen-lockfile`
2. typecheck
3. lint
4. complete tests
5. production source check
6. production build
7. repository hygiene check
8. local clean migration smoke test / exact migration inventory

Provider/runtime gates remain separate: Razorpay live/sandbox lifecycle, MSG91, real marketplace OAuth, WooCommerce SSRF denial against controlled targets, low-memory Android large-file tests, two-tenant IDOR E2E, D1 backup/restore drill, and production-domain cookie/Origin verification.

## Release verdict

**PRIVATE-BETA CANDIDATE after local validation; not yet PRODUCTION-READY.**

Do not enable broad paid acquisition until the runtime gates in `RUNTIME_VERIFICATION_CHECKLIST.md` pass and legal/CA review items are resolved.
