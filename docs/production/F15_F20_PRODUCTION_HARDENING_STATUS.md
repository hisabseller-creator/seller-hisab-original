# F15–F20 production hardening — 9 September 2026

**SOURCE-SIDE F15–F20: COMPLETE — 100% of the achievable source scope described below. EXTERNAL/PRODUCTION GATES: PENDING.** This is scope acceptance after implementation and available local verification, not a measured percentage of production readiness or a security certification. The earlier interrupted 70% handoff is superseded. No remaining source blocker is known within this validated backlog.

| Phase | Status | Source implementation and evidence | Remaining external acceptance |
|---|---|---|---|
| F15 | PARTIAL — external gate only | Admin password creation/reset policy; legacy-compatible v2 PBKDF2 and successful-login CAS upgrade; race-safe reset/session creation; credential-bound step-up; CSRF/rate limits; SQL authority, immutable history and populated replay; safe CI, dependency backport, build/Worker provenance and structured diagnostics. Password/auth/security tests, native Workers KDF, schema and build passed. | Activate and test alerts; run GitHub/full-history secret scan and external VAPT. Password reconfirmation is not MFA: an independently verified administrative second factor remains an operational identity-provider decision. |
| F16 | PARTIAL — external gate only | Durable HMAC receipt/outbox, Queue/DLQ consumers with fenced leases, logical payment intents, ambiguous-order receipt recovery, out-of-order event safety, bounded safe retries/Retry-After, oldest-due reconciliation, audited replay and backlog ages. Billing/concurrency/failure tests passed. | Provision four queues/bindings, verify sandbox capture/refund/dispute and real retry/alert delivery; apply only reviewed forward migrations in a separately authorized release. |
| F17 | PARTIAL — external gate only | Resumable provider pages and historical slices; Shopify nested items/cost throttles/updated-at freshness; durable notifications and reconciliation backstop; Woo read-only onboarding; tenant/entitlement/lease fencing; authoritative source coverage blocks confirmed finance decisions on partial inputs. Many-page, interruption/resume, callback, malformed/token/throttle and partial-data tests passed. | Provider app roles/scopes/quotas and live contract verification; Flipkart notification signing contract/app approval/VAPT prerequisite. Unsupported finance sources remain explicitly partial and require validated files. |
| F18 | DONE | Mobile hero, Hindi/table reflow, keyboard focus, hydration guards, reduced-motion/failure fallback, privacy-safe vitals, lazy parsing/export dependencies and route budgets. Sixty browser scenarios verified across full and targeted batches, with axe and reviewed screenshot comparisons. | Physical-device/assistive-technology review and production RUM observation are operational follow-up; automated checks do not certify all WCAG conformance. |
| F19 | PARTIAL — external gate only | Same-page bilingual URLs remain default; hydrated language switching updates document language. Complete locale metadata and future hi/en routes are gated by explicit activation; canonical/hreflang only when applicable. SEO revision CAS, impact confirmation/audit/rollback, thin-hub gates and truthful metadata. SEO tests passed. | Search Console ownership/measurement and editorial approval of any future locale expansion; URL migration is not a release prerequisite. |
| F20 | PARTIAL — external gate only | Recursive export secret filtering and policy hook; integration-tested deletion/cascades/tenant protection; data/retention/vendor accountability structures; operations backlog/capacity foundation; existing incident/restore runbooks extended; read-only restore verifier tested. | Assign operational owners and approve business RTO/RPO; execute non-production Time Travel drill/tabletop; qualified DPDP/CERT-In legal review; external VAPT and remediation acceptance. |

## Validation

- Unit/property/golden/security/contract suite: **315 tests in 72 files passed** at the final backend/parser checkpoint. Later changes are auth illustration, release provenance, browser checks and documentation/configuration.
- Final typecheck: passed. Lint: passed, zero errors and six warnings (two existing internal navigation assignments, four unused declarations); no lint warning was hidden.
- Production build: passed after the reduced-motion fix; vinext compatibility: 14 supported, zero partial/unsupported issues. Build tool reports plugin timing/static route-classification limitations, not build failures.
- Schema: **56 tables / 23 migrations passed**, including defaults, columns, indexes, foreign keys, raw SQL governance, immutable historical hashes, fresh disposable replay and populated upgrade.
- Repository / production source / SEO checks: passed. Local credential-pattern scan: 477 files passed; this is narrower than Git-history scanning or VAPT.
- Dependency gate: successful service check retained two raw high image-size findings with verified local backport and zero other advisories. See SECURITY_DEPENDENCY_HANDOFF.md; no zero-advisory claim.
- Native Workers password test: passed, version v2, approximately 1.5 seconds for fixture hash plus verify in this local runtime; production latency/CPU must be observed.
- Route initial JavaScript gzip budgets passed: / 171284 B; /blog 154271 B; /blog/article 152038 B; /analyze 305815 B. No eager XLSX/jsPDF/html2canvas dependency on public routes. SBOM: 486 versions.
- Browser / axe / visual comparison: **60 distinct Chromium/WebKit scenarios verified across the full run and targeted recheck.** Full run: 57 passed, one retry-pass and two screenshot failures (Windows header text compositing, 3–152 edge pixels). After the documented 200-pixel allowance, all 13 affected Chromium route/locale checks passed without retry, without updating baselines; the merged result has no unresolved case. The six loading/error/motion checks also passed in both engines. This is a batch-verified result, not a claim that the first full invocation was entirely green.. Screens cover 320, 360, 390, 412, 640/768 and 1280 CSS widths, Hindi headings/tables, empty/loading/error and critical product flows. 640/320 widths model 200%/400% reflow; physical device/OS zoom is not claimed. Pixel comparison permits at most 200 differing pixels for observed Windows header-text compositing variance; overflow/axe assertions remain strict.
- CI definitions are supplied; hosted CI has not been executed in this workspace. Firefox is opt-in nightly, not run locally. Actual provider/dashboard, VAPT and Cloudflare restore drills have not been performed.

## Forward migrations prepared; not applied remotely

1. `drizzle/0019_durable_execution.sql` — billing outbox, logical purchases, reconciliation clocks, job uniqueness.
2. `drizzle/0020_connector_coverage.sql` — resumable checkpoints, coverage, page receipts and leases.
3. `drizzle/0021_blog_locale_metadata.sql` — optional translated editorial metadata.
4. `drizzle/0022_connector_notifications.sql` — durable provider freshness notifications.

Historical 0000–0018 are byte-preserved. Never rerun 0006/0007/0008/0015/0018 to repair production. Only disposable local replay was run. Production ledger/schema consistency and a recovery point must be verified during a separately authorized release.

## Files, limitations and next action

EXACT_CHANGED_FILES.md lists every changed/new source file grouped by primary phase, compared byte-for-byte with the original continuation ZIP. Cross-phase integration files are identified separately. The supplied archive has no actual .git repository; recorded previous HEAD is context, not an asserted commit for these changes. Builds carry a source SHA-256 and build timestamp; Cloudflare Version Metadata supplies the eventual deployed version.

EXTERNAL_RELEASE_GATES.md contains the concrete Cloudflare/provider/Search Console/legal/VAPT/drill checklist. D1/R2 row/reference counters are capacity signals, not measured storage bytes; actual storage/limits and alerts require account configuration. Existing large-export fail-closed limits remain; no unmeasured seller-report upload/staged R2 architecture was introduced.

Next single action after final source verification: review this report and the external release gates, then handle deployment in a separate explicitly authorized task. VALIDATE_LOCAL.ps1 runs local gates only. DEPLOY_AFTER_CHECKS.ps1 is a manual future-release helper and has not been run.

Remote production migrations applied: NO
Production deployed: NO
