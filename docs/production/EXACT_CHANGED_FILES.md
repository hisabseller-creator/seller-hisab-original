# Exact changed/new source files

Byte comparison against SellerHisab-WORK-CONTINUATION-20260908-113241.zip. Files are grouped by primary purpose; integration files affect several phases. Original supplied modifications are preserved. Dependencies, secrets, local DBs and build caches are excluded.

Total changed/new packaged files: 212. Screenshot baselines and evidence documents are counted separately as individual files; this is not an audit-completion score.

## F15

- `.github/dependabot.yml` — NEW
- `.github/workflows/production-checks.yml` — NEW
- `app/api/admin/change-password/route.ts` — MODIFIED
- `app/api/admin/step-up/route.ts` — NEW
- `app/api/auth/logout/route.ts` — MODIFIED
- `app/api/auth/mobile/widget-complete/route.ts` — MODIFIED
- `app/api/auth/password/login/route.ts` — MODIFIED
- `components/admin-reauthentication.tsx` — NEW
- `db/applied-migrations.sha256.json` — NEW
- `db/image-size-backport.sha256.json` — NEW
- `db/schema.ts` — MODIFIED
- `db/sql-governance.json` — NEW
- `docs/production/IMAGE_PARSER_SECURITY_BACKPORT.md` — NEW
- `docs/production/SCHEMA_AUTHORITY.md` — NEW
- `docs/production/SECURITY_DEPENDENCY_HANDOFF.md` — NEW
- `patches/image-size@2.0.2.patch` — NEW
- `scripts/build-provenance.mjs` — NEW
- `scripts/check-dependency-security.mjs` — NEW
- `scripts/check-source-secrets.mjs` — NEW
- `scripts/generate-sbom.mjs` — NEW
- `scripts/reset-production-admin.ps1` — MODIFIED
- `scripts/test-image-parser-backport.mjs` — NEW
- `scripts/test-password-runtime.mjs` — NEW
- `scripts/verify-image-backport.mjs` — NEW
- `scripts/verify-schema.mjs` — NEW
- `server/admin-step-up.ts` — NEW
- `server/admin.ts` — MODIFIED
- `server/auth-audit.ts` — MODIFIED
- `server/auth.ts` — MODIFIED
- `server/credential-reset.ts` — NEW
- `server/password.ts` — MODIFIED
- `server/rate-limit.ts` — MODIFIED
- `server/release.ts` — NEW
- `tests/unit/admin-credential-paths.test.ts` — NEW
- `tests/unit/credential-race.test.ts` — NEW
- `tests/unit/password-version.test.ts` — NEW

## F16

- `app/api/admin/operations/replay/route.ts` — NEW
- `app/api/payments/order/route.ts` — MODIFIED
- `app/api/payments/webhook/route.ts` — MODIFIED
- `components/dashboard/unlock-report.tsx` — MODIFIED
- `docs/production/DURABLE_JOB_REPLAY.md` — NEW
- `drizzle/0019_durable_execution.sql` — NEW
- `server/billing-event-processing.ts` — NEW
- `server/billing-jobs.ts` — NEW
- `server/billing-reconciliation.ts` — MODIFIED
- `server/job-replay.ts` — NEW
- `server/payment-intent-recovery.ts` — NEW
- `server/payment-intents.ts` — NEW
- `server/provider-http.ts` — NEW
- `server/razorpay.ts` — MODIFIED
- `tests/unit/billing-event-ordering.test.ts` — NEW
- `tests/unit/billing-lease.test.ts` — NEW
- `tests/unit/durable-billing.test.ts` — NEW
- `tests/unit/job-replay.test.ts` — NEW
- `tests/unit/provider-http.test.ts` — NEW
- `tests/unit/rc2-billing-trials-contract.test.ts` — MODIFIED

## F17

- `app/api/account/connections/woocommerce/authorize/route.ts` — NEW
- `app/api/connectors/shopify/webhook/route.ts` — NEW
- `app/api/connectors/woocommerce/callback/route.ts` — NEW
- `core/cash/reconciliation.ts` — MODIFIED
- `core/connectors/coverage.ts` — NEW
- `drizzle/0020_connector_coverage.sql` — NEW
- `drizzle/0022_connector_notifications.sql` — NEW
- `server/cash.ts` — MODIFIED
- `server/connectors/jobs.ts` — MODIFIED
- `server/connectors/notifications.ts` — NEW
- `server/connectors/pages.ts` — NEW
- `server/connectors/providers.ts` — MODIFIED
- `server/connectors/sync.ts` — MODIFIED
- `tests/helpers/connector-fixture.ts` — NEW
- `tests/unit/connector-callbacks.test.ts` — NEW
- `tests/unit/connector-coverage.test.ts` — NEW
- `tests/unit/connector-resume.test.ts` — NEW

## F18

- `app/api/telemetry/vitals/route.ts` — NEW
- `app/globals.css` — MODIFIED
- `components/account-workspace.tsx` — MODIFIED
- `components/analyze-wizard.tsx` — MODIFIED
- `components/auth-lottie.tsx` — MODIFIED
- `components/dashboard/dashboard.tsx` — MODIFIED
- `components/web-vitals.tsx` — NEW
- `core/ads/parser.ts` — MODIFIED
- `core/inventory/parser.ts` — MODIFIED
- `core/parsers/costs.ts` — MODIFIED
- `core/parsers/files.ts` — MODIFIED
- `core/performance.ts` — NEW
- `playwright.config.ts` — MODIFIED
- `scripts/check-performance-budget.mjs` — NEW
- `scripts/seed-browser-fixture.mjs` — NEW
- `tests/e2e/critical-accessibility.spec.ts` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/analyze-empty-1280-chromium-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/analyze-empty-1280-webkit-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/analyze-empty-320-chromium-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/analyze-empty-320-webkit-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/analyze-empty-640-chromium-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/analyze-empty-640-webkit-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/app-empty-1280-chromium-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/app-empty-1280-webkit-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/app-empty-320-chromium-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/app-empty-320-webkit-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/app-empty-640-chromium-win32.png` — NEW
- `tests/e2e/critical-accessibility.spec.ts-snapshots/app-empty-640-webkit-win32.png` — NEW
- `tests/e2e/loading-error-states.spec.ts` — NEW
- `tests/e2e/loading-error-states.spec.ts-snapshots/login-error-1280-chromium-win32.png` — NEW
- `tests/e2e/loading-error-states.spec.ts-snapshots/login-error-1280-webkit-win32.png` — NEW
- `tests/e2e/loading-error-states.spec.ts-snapshots/login-error-320-chromium-win32.png` — NEW
- `tests/e2e/loading-error-states.spec.ts-snapshots/login-error-320-webkit-win32.png` — NEW
- `tests/e2e/loading-error-states.spec.ts-snapshots/login-loading-1280-chromium-win32.png` — NEW
- `tests/e2e/loading-error-states.spec.ts-snapshots/login-loading-1280-webkit-win32.png` — NEW
- `tests/e2e/loading-error-states.spec.ts-snapshots/login-loading-320-chromium-win32.png` — NEW
- `tests/e2e/loading-error-states.spec.ts-snapshots/login-loading-320-webkit-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-1280-chromium-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-1280-webkit-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-320-chromium-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-320-webkit-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-360-chromium-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-360-webkit-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-390-chromium-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-390-webkit-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-412-chromium-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-412-webkit-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-768-chromium-win32.png` — NEW
- `tests/e2e/mobile-accessibility.spec.ts-snapshots/blog-768-webkit-win32.png` — NEW
- `tests/e2e/product-flow.spec.ts` — MODIFIED
- `tests/e2e/runtime-diagnostics.spec.ts` — NEW

## F19

- `drizzle/0021_blog_locale_metadata.sql` — NEW

## F19 (article rendering also F18)

- `app/api/admin/blog/route.ts` — MODIFIED
- `app/api/admin/seo-settings/route.ts` — MODIFIED
- `app/blog/[slug]/page.tsx` — MODIFIED
- `app/en/blog/[slug]/page.tsx` — NEW
- `app/hi/blog/[slug]/page.tsx` — NEW
- `app/news/page.tsx` — MODIFIED
- `app/sitemap.ts` — MODIFIED
- `app/videos/page.tsx` — MODIFIED
- `components/admin-blog-manager.tsx` — MODIFIED
- `components/admin-seo-manager.tsx` — MODIFIED
- `components/blog-article.tsx` — MODIFIED
- `components/blog-localized-content.tsx` — MODIFIED
- `core/blog-cms.ts` — MODIFIED
- `core/blog-locales.ts` — NEW
- `core/seo-settings.ts` — MODIFIED
- `scripts/check-seo-source.mjs` — MODIFIED
- `server/blog-media.ts` — MODIFIED
- `server/blog.ts` — MODIFIED
- `server/seo-settings.ts` — MODIFIED
- `tests/e2e/localized-article.spec.ts` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-1280-chromium-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-1280-webkit-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-320-chromium-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-320-webkit-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-360-chromium-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-360-webkit-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-390-chromium-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-390-webkit-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-412-chromium-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-412-webkit-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-768-chromium-win32.png` — NEW
- `tests/e2e/localized-article.spec.ts-snapshots/hindi-article-768-webkit-win32.png` — NEW
- `tests/unit/blog-locales.test.ts` — NEW
- `tests/unit/seo-activation-governance.test.ts` — NEW

## F20

- `app/api/admin/operations/health/route.ts` — NEW
- `core/privacy-export.ts` — NEW
- `docs/production/BACKUP_RESTORE_RUNBOOK.md` — MODIFIED
- `docs/production/INCIDENT_RESPONSE.md` — MODIFIED
- `docs/production/data-governance.json` — NEW
- `docs/production/slo-policy.json` — NEW
- `scripts/verify-restore.mjs` — NEW
- `server/account-lifecycle.ts` — MODIFIED
- `server/operational-signals.ts` — NEW
- `server/retention.ts` — MODIFIED
- `tests/unit/privacy-export.test.ts` — NEW
- `tests/unit/privacy-lifecycle-integration.test.ts` — NEW

## Shared F15–F20 integration

- `.gitignore` — MODIFIED
- `app/api/account/connections/jobs/route.ts` — NEW
- `app/api/account/connections/sync/route.ts` — MODIFIED
- `app/api/health/route.ts` — MODIFIED
- `app/layout.tsx` — MODIFIED
- `core/cash/bank-parser.ts` — MODIFIED
- `docs/production/EXTERNAL_RELEASE_GATES.md` — NEW
- `eslint.config.mjs` — MODIFIED
- `package.json` — MODIFIED
- `pnpm-lock.yaml` — MODIFIED
- `pnpm-workspace.yaml` — MODIFIED
- `scripts/check-repo-hygiene.mjs` — MODIFIED
- `server/localized-blog-page.tsx` — NEW
- `server/msg91-widget.ts` — MODIFIED
- `server/request-body.ts` — NEW
- `server/runtime.ts` — MODIFIED
- `tests/fixtures/compression-bomb.zip` — NEW
- `tests/fixtures/unsafe-path.zip` — NEW
- `tests/fixtures/valid-reports.zip` — NEW
- `tests/helpers/d1.ts` — NEW
- `tests/unit/fetch-metadata.test.ts` — NEW
- `tests/unit/hardening-recovery.test.ts` — NEW
- `tests/unit/locale-route-gate.test.ts` — NEW
- `tests/unit/provider-pagination-contracts.test.ts` — NEW
- `tests/unit/restore-verifier.test.ts` — NEW
- `vite.config.ts` — MODIFIED
- `vitest.config.ts` — MODIFIED
- `worker/index.ts` — MODIFIED
- `wrangler.jsonc` — MODIFIED
- `wrangler.test.jsonc` — NEW

## Shared validation and handoff

- `DEPLOY_AFTER_CHECKS.ps1` — NEW
- `START_HERE_HANDOFF.md` — NEW
- `VALIDATE_LOCAL.ps1` — NEW
- `docs/production/EXACT_CHANGED_FILES.md` — NEW
- `docs/production/F15_F20_PRODUCTION_HARDENING_STATUS.md` — NEW
- `docs/production/evidence/dependency-audit.json` — NEW
- `docs/production/evidence/dependency-mitigations.json` — NEW
- `docs/production/evidence/performance-budgets.json` — NEW
- `docs/production/evidence/sbom.cdx.json` — NEW
- `docs/production/evidence/validation-results.json` — NEW

Historical SQL 0000–0018 was byte-verified unchanged. The archive contains no Git object database; recorded historical HEAD is context only.
