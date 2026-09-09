# SellerHisab — FINAL Validated Production Audit & Implementation Roadmap

**Second-pass source validation + 2026 research reconciliation**  
**Audit date:** 8 September 2026  
**Snapshot:** `SellerHisab-FULL-PROJECT-AUDIT-20260908-100022.zip`  
**Mode:** read-only audit; no source changes, migrations or deployment were performed by this audit.

---

## 1. Final verdict

SellerHisab is no longer an early prototype. The repository already contains a substantial finance/reconciliation engine, multi-marketplace file/API foundations, tenant-aware account workspace, billing controls, R2-backed blog media, admin SEO/content controls, governed action workflows, and a meaningful test suite. The core product direction is sound and should **not** be rebuilt from scratch.

However, I would **not** call it “top production engineering complete” yet. The second pass confirms **no proven P0/blocking data-corruption vulnerability in the snapshot**, but it confirms nine cross-cutting P1 engineering programs that should be closed before aggressively scaling paid acquisition, high-volume API sync, or finance-critical reliance.

The first pass contained **118 raw findings** (24 P1, 74 P2, 20 P3). The second pass does not simply repeat those rows: duplicates are consolidated, several findings are corrected/refined, implemented strengths are separated from defects, and the remaining work is organized into implementation phases.

### Final launch posture

| Area | Final position |
|---|---|
| Product/finance architecture | **Strong foundation** |
| Browser-local privacy boundary | **Strong — preserve** |
| Payment correctness controls | **Good core, async/retry/idempotency maturity still needed** |
| Official connector foundation | **Good, but completeness/backfill is the largest product-data risk** |
| Database/migration governance | **P1 gap: schema source is not authoritative** |
| Authentication | **P1 KDF/admin-recovery hardening needed** |
| Mobile/UI | **Generally solid, targeted responsive/a11y/perf gaps remain** |
| SEO/editorial | **Broad implementation; multilingual search architecture is future growth, not a blocker** |
| Observability/release engineering | **P1 maturity gap** |
| Testing | **Strong unit/property base; critical E2E/visual/a11y/perf gates incomplete** |
| Compliance/DR | **Baseline docs exist; operational evidence and legal matrix still needed** |

---

## 2. Snapshot and method

- Files inspected: **510**
- TypeScript/TSX files: **327**
- Test files: **65**
- API route files: **52**
- D1 migration files: **19** (`0000`–`0018`)
- Source was traced across UI → API route → server module → D1/R2/provider boundary → tests/runbooks.
- High-risk findings were revalidated against exact source, not inferred from file names.
- Platform/API recommendations were reconciled against current official OWASP, Cloudflare, Razorpay, Google Search, Shopify, Amazon SP-API, W3C, MeitY and CERT-In material available on 8 Sep 2026.
- Commercial market scan was used only for positioning/prioritization, not as a source of security or compliance truth.

### What cannot be proven from the ZIP

Cloudflare dashboard-only settings/history, actual production secret custody, Search Console data, Razorpay dashboard configuration, external provider approvals/quotas, completed restore/tabletop drills, DNS/WAF account rules, and legal applicability cannot be proven from source alone. They are explicitly listed as off-repo gates later instead of being guessed.

---

## 3. Second-pass corrections — important changes from the first report

- **Amazon API generation:** The code already uses **Orders API v2026-01-01** and current Finances transactions generation. This is a strength. The real defect is bounded pagination/checkpointing, not API-version obsolescence.
- **Backup/restore:** `docs/production/BACKUP_RESTORE_RUNBOOK.md` exists and defines RPO/RTO targets and a restore drill. The remaining gap is evidence/automation that the drill has actually been executed.
- **Incident response:** `docs/production/INCIDENT_RESPONSE.md` exists with SEV examples and response steps. It is not “missing”; it needs owners, contacts, regulatory decision paths, communications templates and exercised evidence.
- **Audit ZIP test-results:** `test-results/` being present in this audit archive is packaging hygiene, **not a production defect**. Remove it from the product roadmap.
- **Multilingual SEO:** The F14 same-URL Hindi/English body switch is useful UX and should stay. It is not equivalent to indexable locale URLs; separate URLs + `hreflang` belong in a later organic-growth phase, not launch hardening.
- **AI search / llms.txt:** Do not spend engineering time treating `llms.txt`, “AEO” or “GEO” tricks as Google ranking requirements. Keep helpful content/technical SEO strong and measure the new Search Console generative-AI reports.
- **Microservices:** Do **not** split this into microservices now. The modular-monolith/Workers architecture is appropriate; durability and observability should be added inside the current platform first.
- **D1 read replication/caching:** Do not add complexity pre-emptively. Measure real read pressure and route latency first.

---

## 4. Nine confirmed P1 implementation programs

These nine programs collapse the 24 raw P1 rows into non-duplicative work. Closing these provides much more value than addressing findings one-by-one.

| Program | Scope | Raw P1 crosswalk | Source-validated risk | Required engineering | Exit gate |
|---|---|---|---|---|---|
| P1-A | Credential policy + versioned KDF migration | SEC-01, SEC-02, SEC-03 | `server/password.ts` uses PBKDF2-SHA256 at 100,000 rounds; verifier accepts only exactly that round count. Mobile OTP registration/recovery accepts 8+ characters and calls the generic hasher even when the phone/email resolves to an admin. | Move to a versioned password-hash format. Prefer a Workers-compatible Argon2id implementation after runtime benchmarking; if PBKDF2 is retained, raise to current OWASP guidance (600k+ HMAC-SHA256). Verify legacy hashes, then rehash on successful login. On admin recovery, resolve admin status before hashing and apply `validateAdminPassword`. | Old users can login; successful login upgrades old hashes; admin OTP reset cannot set a non-admin-strength password; timing/load benchmark passes. |
| P1-B | CI + supply-chain + release provenance | SEC-13, OPS-01 (+ OPS-03/ARCH-07) | The snapshot has strong local scripts but no repository-native CI workflow. Runtime release identity is a static `RELEASE_ID="launch-hardening-rc1"`. | Add protected CI for typecheck/lint/unit/migration replay/selected E2E, dependency and secret scanning, SBOM/artifact retention. Add Cloudflare Version Metadata binding and emit real Worker version with logs/health. | Every merge has reproducible gates; exact build/version is traceable from request/log to deploy artifact; no manual-only release gate. |
| P1-C | Durable async processing for webhooks and connector jobs | PAY-01, PAY-07, CON-07 (+ ARCH-04) | Razorpay webhook claims an event, runs `processEvent`, completes it, then returns 2xx. Manual connector sync enqueues a D1 job and immediately processes it in the HTTP request. | Use D1 as durable event/outbox state plus Cloudflare Queue or Workflow for off-request processing. Webhook: verify → persist/dedupe → enqueue/outbox → return 2xx quickly; workers perform reconciliation with retry/DLQ. Connector requests should return a job ID/status, not perform the whole sync inline. | Webhook response stays comfortably <5s during provider slowness; job retry/DLQ/replay is safe; duplicate events/jobs remain idempotent. |
| P1-D | Provider network resilience | PAY-02, PAY-03, CON-08 | Razorpay fetch helpers/order creation have no explicit AbortSignal timeout or bounded retry policy. Connector generic timeout exists, but provider-aware 429/5xx/backoff behavior is incomplete. | Centralize provider HTTP policy: bounded timeouts, retry only safe/idempotent operations, honor Retry-After, exponential backoff+jitter, classify 4xx vs 429/5xx/network errors, record retryable state. Never blindly retry provider order creation without an idempotency strategy. | Failure-injection tests prove bounded request time, correct retries, no duplicate financial side effects, and clear user/admin recovery state. |
| P1-E | Payment intent idempotency + concurrency | PAY-04 | One-time payment creation does SELECT → remote Razorpay order creation → INSERT. Two concurrent requests can pass the SELECT before either INSERT is durable. | Create a server idempotency key/payment-intent row with a DB uniqueness invariant before remote side effect. Reuse pending intent/provider order when equivalent; state-machine all uncertain outcomes. | Parallel test of same analysis/product produces one active intent/provider order and one entitlement after capture. |
| P1-F | Connector completeness, backfill and finance-grade coverage contract | CON-01–05, CON-17 | User sync is limited to 1–30 days. WooCommerce stops after 5×100 rows; Shopify Orders after 5×50; Shopify Payments reads first 100 transactions/payouts; Amazon Orders/Finances use bounded page loops. Warnings exist but completeness is not a first-class state. | Implement cursor/token pagination to exhaustion through durable chunked jobs, provider-specific rate-limit handling, checkpoints and resumable backfill. Allow historical backfill in safe date slices. Persist coverage state (`complete`, `partial`, `truncated`, `stale`, `failed`) and coverage ranges per source. Finance actions that require complete evidence must explicitly downgrade confidence/block when incomplete. | High-volume fixture/provider sandbox proves >current caps with no truncation; interruption resumes from checkpoint; UI/API exposes machine-readable coverage/finality. |
| P1-G | Schema authority + migration parity | DB-01 | `drizzle.config.ts` generates from `db/schema.ts`, but production migrations define tables/columns not represented in the TypeScript schema. Eight migration-created tables are absent from schema, including billing audit, connector jobs, billing trials, ledger revisions and deletion receipts. | Reconcile `db/schema.ts` to the already-applied migration reality **without rerunning applied migrations**. Add a migration-replay parity test that creates a fresh temp DB from 0000–0018 and compares expected tables/columns/indexes/triggers. Maintain one canonical schema contract going forward. | Fresh migration replay and schema parity test pass; generating a new unrelated migration cannot accidentally recreate/drop 0015/0016 objects. |
| P1-H | Workers observability + SLO/alerts | OPS-02, OPS-04 | Structured request logs exist, but Wrangler source config has no Workers Logs observability configuration, no runtime version metadata, and no repo SLO/error-budget thresholds. | Enable Workers observability/logs (and traces where useful), use Version Metadata, define SLIs/SLOs for API 5xx/latency, webhook age, connector queue age/failure, billing reconciliation backlog and health. Route alerts to an owned channel with runbook links. | A synthetic failure produces a searchable log with exact version/request ID and a test alert; dashboard shows queue/provider/billing health and SLO burn. |
| P1-I | Production-critical E2E + mobile/a11y/performance gates | OPS-06, PERF-01, UI-01 | The Playwright suite has only five product-flow tests. No RUM Core Web Vitals is visible. Blog mobile CSS still sets `.blog-article-hero { height: 19rem; }` under 520px while the component uses a 16:9 hero, allowing crop/geometry mismatch. | Remove the conflicting fixed mobile hero height; add viewport visual regressions and WCAG/axe checks. Add RUM Core Web Vitals. Expand E2E to admin blog bilingual save/publish, billing/entitlement, payment webhook/idempotency test harness, connector job lifecycle, account export/delete and critical recovery flows. Add bundle/perf budgets in CI. | 360/390/430px screenshots show no horizontal/crop regression; WCAG 2.2 AA automated baseline passes; RUM is collected; critical flows gate releases. |

### Direct source evidence for the highest-risk programs

- `server/password.ts:4,23-35` — 100k PBKDF2 and exact-round verifier; `13-20` contains the stronger admin policy but generic hashing does not invoke it.
- `app/api/auth/mobile/widget-complete/route.ts:14-18,71,86,94,111` — 8-char schema and generic hashing before admin response classification.
- `app/api/payments/webhook/route.ts:45-53,73+` — event is processed synchronously before success response.
- `server/razorpay.ts:111-120` and `app/api/payments/order/route.ts:80+` — provider fetch paths without an explicit abort/retry envelope.
- `app/api/account/connections/sync/route.ts:14,31-32` — 30-day max and request-time job processing.
- `server/connectors/sync.ts:125,162,210-218,243-281` — fixed page ceilings/first-100 reads and bounded token loops.
- `db/schema.ts` versus `drizzle/0015_launch_hardening.sql` and `0016_billing_trials.sql` — eight migration-created tables absent from schema: `account_deletion_receipts`, `billing_audit_events`, `billing_trial_claims`, `billing_trial_settings`, `connector_sync_jobs`, `ledger_entry_revisions`, `subscription_payment_events`, `support_request_events`.
- `wrangler.jsonc:27-44` — static release ID, D1/R2 bindings and crons, but no source observability/version-metadata/Queue/Workflow/edge-rate-limit bindings.
- `components/blog-article.tsx:30` plus `app/globals.css:953` — 16:9 hero and small-screen fixed height conflict.
- `tests/e2e/product-flow.spec.ts:16-67` — five E2E scenarios only.

---

## 5. P2 hardening backlog — grouped, not duplicated

| Workstream | Raw findings | Consolidated action |
|---|---|---|
| Security/session/abuse | SEC-04–12, SEC-14–18 | Idle session/rotation strategy; optional `__Host-` cookie migration; stronger Fetch-Metadata/CSRF posture where relevant; CSP nonce/hash path to reduce `unsafe-inline`; adaptive challenge for suspicious public auth/contact flows; edge rate limiting as an abuse shield while D1 remains authoritative for business quotas; admin MFA/role record; consistent mutation limits; formal security-event taxonomy/alerts. |
| Billing operations | PAY-05, PAY-06, PAY-09 | Fair reconciliation scheduling so old unresolved records cannot starve; cursor/pagination for admin billing operations; concurrency/provider-state integration tests. |
| Connector operations | CON-06, CON-09–16 | Remove Flipkart fixed cap; atomic job dedupe; tune cron/consumer throughput from queue age; optionally use Shopify/Flipkart notifications for freshness; evaluate WooCommerce application authorization; quarterly API-version review; provider sandbox/recorded contract tests. Keep Amazon current API generations. |
| Database/retention/capacity | DB-02–08 | Document triggers in schema contract; replay upgrade tests; execute restore drills; D1 size/write/latency alarms; formal retention schedule; export pagination/streaming if 100k cap becomes real. Do not add read replication without measured need. |
| UI/accessibility | UI-02–12 | Mobile table scrolling; align site/article language state; if localized SEO grows, localize title/subtitle/metadata; automated axe; Focus Not Obscured; larger language-toggle tap targets; visual regression; wider device matrix; reduce heavy glass effects on low-end devices; async progress/retry UX. |
| Performance | PERF-02–06 | Lazy-load/split XLSX/jsPDF/html2canvas/analyzer paths; CI bundle budget; benchmark large imports on low-end Android/desktop; revisit blog image optimization; cache only measured safe routes. |
| SEO/content distribution | SEO-01–12 | Per-language diagnostics; safer confirmation/audit for global indexing controls; accurate sitemap lastModified; gate thin news/video hubs; operational Search Console/IndexNow dashboard. Separate locale URLs + hreflang only when bilingual organic search is a priority. Keep editorial/structured-data strengths. |
| Ops/release/DR | OPS-03, OPS-05, OPS-07–16 | Add vinext compatibility gate while beta; visual/a11y tests; failure-injection/chaos for provider faults; DR drill evidence; readiness diagnostics; retire unused AWS S3 surface after R2 stability; protected deployment approval/evidence. Update stale docs. |
| Privacy/compliance | PRIV-01–08 | Policy-backed retention/deletion matrix; DPDP phased readiness; determine CERT-In applicability with qualified Indian counsel/security advisor; processor/vendor inventory; breach notification decision matrix and contacts. Preserve opt-in benchmarking and secret-exclusion strengths. |
| Architecture governance | ARCH-01–08 | Preserve browser-local file boundary, finance layering and tenant controls. Keep marketplace write automation disabled until approvals/audit/recovery controls are mature. Unify parser/engine/release provenance. Add confirmations/audit/rollback for high-impact admin settings. |

---

## 6. Implemented strengths — protect these, do not rebuild them away

- **Browser-local analysis boundary:** raw marketplace uploads are designed to be parsed/analysed locally; server-side persistence is centered on normalized/account data, not a raw-file warehouse.
- **Evidence-first finance model:** parser/normalization/reconciliation/decision layers, ledger lineage and revision/audit concepts are substantially more defensible than a simple dashboard calculator.
- **Tenant/RBAC integrity:** tenant-aware account/workspace patterns and cross-tenant controls are extensive for this stage.
- **Billing verification:** captured state, amount/currency/provider order checks and entitlement controls are already present; the next step is durability, not replacing the model.
- **Connector credential security:** OAuth state, encrypted credential storage and SSRF defenses are meaningful strengths.
- **Provider currency:** Amazon Orders v2026-01-01 is already used; Shopify API generation is current in the snapshot. Focus on pagination and lifecycle governance.
- **Admin-managed product operations:** SEO, blog, redirects, trials and other controls are configurable rather than broadly hard-coded.
- **Editorial trust:** author entity, editorial/corrections policies, review/source fields and structured-data breadth are strong.
- **R2 blog media boundary:** native R2 media storage has validation/proxy/security controls and remains separate from seller raw financial files.
- **Bilingual blog UX:** Hindi/English bodies, same-page toggle, safe server-side sanitization model and clean article layout are a useful product capability.
- **Testing depth:** 65 test files and many unit/property/contract tests provide a better base than the small E2E count alone suggests.
- **Operational docs exist:** deployment, rollback, backup/restore, incident-response and launch-hardening documents are present; mature them with automation/drill evidence rather than rewriting from zero.

---

## 7. Product/market positioning — what the 2026 market says to build and not build

A current market scan reinforces an important product decision: **generic “profit dashboard” functionality is not enough to differentiate SellerHisab.** Established Amazon-focused tools already combine profit, fees, returns, PPC, inventory, reimbursements, alerts and team permissions; ecommerce-accounting tools also automate marketplace bookkeeping and bank-deposit matching. Indian marketplace calculators increasingly cover basic Amazon/Flipkart/Meesho fee/profit comparisons.

Therefore SellerHisab should keep its moat centered on:

- **Indian multi-marketplace financial truth**, not a single-channel KPI clone.
- **Money trail:** sale/order → marketplace adjustments/settlement → bank cash → explainable difference.
- **Finality/completeness states:** confirmed vs provisional vs incomplete/truncated/stale evidence.
- **Action with ₹ impact and confidence:** not merely charts; show what to investigate/reprice/recover and why.
- **Privacy-first file mode:** useful before API connection and without sending raw seller files to the server.
- **Evidence packs / CA-close / claim support:** prepare defensible evidence, but avoid risky marketplace write automation until controls are mature.
- **Bilingual, non-accountant UX for Indian sellers.**

### Do not chase now

- Generic listing-AI/SEO generators, label croppers or generic product-research clones.
- Feature parity for its own sake with large Amazon-only suites (repricer, review automation, keyword harvesting) unless customer evidence makes it strategic.
- Microservices, Kafka-style infrastructure or D1 read replicas before measured scale requires them.
- Marketplace write/claim automation before idempotency, approvals, audit trails, reversibility and provider policy are proven.
- “AI SEO/AEO/GEO” gimmicks or `llms.txt` work presented as guaranteed ranking levers.

---

## 8. Final major-phase roadmap (F15 onward)

### F15 — Security, schema authority, CI and release observability

**Goal:** make the current system reproducible, traceable and safe to evolve.

- Implement versioned password hashing + admin OTP reset policy; migrate hashes on successful authentication.
- Reconcile Drizzle schema to all applied migrations through 0018; add migration replay/parity tests. **Do not rerun applied migrations.**
- Add protected CI: typecheck, lint, unit/contract/property tests, migration replay, selected E2E, secret/dependency scan, SBOM, artifact retention.
- Enable Workers Logs observability, version metadata, release-aware health/log events.
- Define first SLOs/alerts and ownership: API 5xx/latency, auth failures, billing backlog, webhook age, connector queue age/failure.

**F15 exit:** every release is reproducible and attributable; schema is canonical; auth hash migration works; a synthetic error is traceable and alerts correctly.

### F16 — Durable billing/event architecture

- Introduce Queue/Workflow + D1 outbox/event state for Razorpay and other durable background operations.
- Return webhook 2xx after secure durable receipt, not after slow reconciliation.
- Centralize provider timeout/backoff/error classification.
- Add payment-intent idempotency/unique invariant and parallel concurrency tests.
- Add DLQ/replay admin tooling and user-facing “pending/retrying/recovered” states.

**F16 exit:** provider slowness cannot make normal webhook handling miss Razorpay’s response window; duplicates/retries cannot double-entitle or create uncontrolled duplicate payment attempts.

### F17 — Connector completeness and historical backfill

- Replace every fixed page ceiling with resumable cursor/token pagination to source exhaustion.
- Run large syncs as chunked durable jobs with checkpoints; implement >30-day backfill by date slices.
- Persist machine-readable data completeness/finality and coverage ranges.
- Use provider-aware rate-limit/backoff rules; surface 429 quota pressure.
- Add high-volume fixtures/sandbox/recorded contracts for Amazon, Shopify, WooCommerce, Flipkart and supported sources.
- Optionally add provider notifications/webhooks where they materially improve freshness; polling remains a recovery path.

**F17 exit:** a high-volume account can sync/backfill to completion without silent truncation, and every downstream finance decision knows whether evidence is complete.

### F18 — Mobile UX, accessibility, performance and release E2E

- Remove blog mobile fixed-height conflict; define image rendering contract and viewport visual tests.
- Make article tables and dense finance tables narrow-screen safe.
- Add WCAG 2.2 AA automated baseline (axe) plus manual keyboard/focus/zoom checks.
- Add responsive visual matrix (minimum 360/390/430/768/1024 and representative desktop).
- Add Core Web Vitals RUM and route/device dashboards.
- Code-split heavy analysis/export dependencies and add bundle/performance budgets.
- Expand E2E across payment/billing, connector job states, admin bilingual blog, trials, export/delete and recovery/failure states.

**F18 exit:** mobile screenshots are stable, critical flows gate deploys, WCAG baseline passes, and performance decisions use field data rather than build warnings alone.

### F19 — Multilingual search growth + measurable content operations

- Keep current bilingual same-page UX until organic multilingual growth warrants URL expansion.
- When activated: language-specific URLs, localized title/subtitle/metadata, self-canonical, reciprocal `hreflang`, `x-default`, locale sitemaps/links.
- Run SEO diagnostics independently per locale.
- Connect Search Console Search/Discover **Generative AI performance reports** to content review cadence.
- Add high-risk admin SEO setting confirmation, audit trail and rollback/default restore.
- Gate thin news/video hubs and use truthful `lastModified` values.

**F19 exit:** every indexable language version has an explicit crawl/canonical/hreflang contract and content performance is measured, including generative-AI visibility.

### F20 — Compliance, DR and operations maturity

- Execute and record D1 restore drill against non-production DB; verify billing/ledger/connector integrity and provider reconciliation.
- Run incident tabletop; add owners, contact tree, evidence checklist and notification decision matrix.
- Create data-category retention/deletion schedule with purpose, legal basis/justification, retention, deletion/anonymization behavior and owner.
- Maintain vendor/processor inventory for Cloudflare, Razorpay, MSG91 and other processors/subprocessors used in production.
- Prepare for phased DPDP Rules commencement; get qualified Indian legal/privacy review for exact obligations.
- Confirm CERT-In Directions applicability with qualified counsel/security advisor, including incident reporting/log-location requirements where applicable.
- Add capacity/cost thresholds and quarterly DR/security/release reviews.
- Remove legacy AWS S3 surface after R2 rollback need is formally retired.

**F20 exit:** a restore/tabletop can be demonstrated with timestamps/evidence, retention/vendor ownership is documented, and regulatory obligations are mapped to accountable people/processes.

### F21 — Scale only when metrics justify it (optional)

Do not pre-build this phase. Consider read replication, more specialized services, additional accounting integrations, or high-throughput architecture only after queue age, D1 pressure, request latency, provider volume or customer demand establishes the need.

---

## 9. Recommended order of execution

1. **F15 first.** Schema authority + auth + CI + observability reduce the risk of every later change.
2. **F16 second.** Payments/webhooks become durable before acquisition volume rises.
3. **F17 third.** Connector completeness is required before “real profit” can be trusted at scale.
4. **F18 fourth.** Lock mobile/accessibility/performance/E2E once backend execution semantics are stable.
5. **F19 fifth.** Scale bilingual organic search after technical/data foundations are reliable.
6. **F20 sixth.** Operationalize compliance/DR before larger customer/data exposure.
7. **F21 only from metrics/customer evidence.**

---

## 10. Critical acceptance tests that should exist before calling SellerHisab “top production level”

1. Admin OTP recovery cannot set a weak password; legacy and new KDF hashes coexist during migration and upgrade safely.
2. Fresh DB replaying migrations 0000–0018 matches canonical schema; no already-applied migration is manually rerun.
3. Two parallel identical payment requests result in one active intent/provider order path.
4. Webhook duplicate + out-of-order + provider timeout tests do not double-entitle or lose the event.
5. Razorpay webhook receipt remains <5s even when downstream provider APIs are slow/unavailable.
6. Amazon/Shopify/WooCommerce/Flipkart high-volume pagination completes past current hard caps and can resume after forced interruption.
7. Every sync exposes coverage start/end and completeness/finality state; incomplete data cannot silently produce “confirmed” finance decisions.
8. Cloudflare logs show request ID + actual Worker version; synthetic P1 failure raises an owned alert.
9. Admin bilingual blog create/edit/publish, payment/billing, connector lifecycle, account export/delete and key recovery paths run in E2E.
10. 360/390/430px mobile visual suite shows no horizontal overflow/hero clipping; article tables remain usable.
11. Automated WCAG 2.2 AA baseline + keyboard/focus/zoom manual checks pass for public, auth, analysis, account and admin critical flows.
12. Core Web Vitals RUM exists by route/device/network cohort; performance budget prevents accidental regression.
13. Non-production restore drill passes integrity/provider reconciliation and is recorded.
14. Incident tabletop demonstrates who declares severity, who contacts providers/users/regulators when applicable, and where evidence/logs are retained.

---

## 11. Off-repo verification checklist — do not mark these “implemented” from source alone

- [ ] Cloudflare Workers Logs/trace retention, WAF/rate-limit rules, DNS/TLS settings and account alert destinations.
- [ ] D1 Time Travel/backup availability and an actual restore-drill record.
- [ ] Razorpay webhook endpoint status/events/secret rotation and real provider retry history.
- [ ] MSG91 OTP widget production restrictions, allowed domains, abuse controls and secret rotation.
- [ ] Amazon/Shopify/Flipkart/WooCommerce application approvals, scopes, quotas and production webhook/notification settings.
- [ ] Google Search Console ownership, sitemap/index coverage, crawl errors, Core Web Vitals and generative-AI performance data.
- [ ] External vulnerability scan/penetration test and dependency/SBOM review of the deployed artifact.
- [ ] Legal review of Terms/Privacy/Refund, retention/deletion choices, DPDP applicability and CERT-In obligations.
- [ ] Customer support/on-call ownership, recovery contacts and incident notification channels.

---

## 12. 2026 research baseline used for final decisions

The final recommendations were checked against these current sources; the report paraphrases them rather than copying text:

- OWASP Password Storage Cheat Sheet — Argon2id preferred; PBKDF2-HMAC-SHA256 600,000+ when PBKDF2 is required.
- Razorpay Webhook Best Practices / Webhook settings — webhook 2xx response expected within 5 seconds; failures retry with exponential backoff for 24 hours.
- Cloudflare Workers Logs — native Workers log collection/analysis; source config must enable observability for existing Workers.
- Cloudflare Queues + Dead Letter Queues — off-request guaranteed delivery, retries/delays and DLQ after retry exhaustion.
- Cloudflare Workflows — durable multi-step execution with persisted step state, retries and waits for external events.
- Cloudflare Workers Version Metadata — runtime Worker version ID/tag/timestamp binding.
- Cloudflare Workers Rate Limiting binding — route/customer-specific edge rate limiting; use as an abuse shield, not finance/accounting truth.
- Google Search multilingual guidance — distinct URLs per language are recommended for search discoverability; use hreflang between versions.
- Google Search Console Generative AI performance reports — dedicated Search/Discover AI visibility reports, rolled out worldwide by 31 Aug 2026.
- Amazon SP-API Orders migration guide — Orders v2026-01-01 is the current generation and uses pagination tokens; SellerHisab already uses it.
- Amazon Finances `listTransactions` — continue with `nextToken` until null for a complete list.
- Shopify GraphQL pagination — `PageInfo.hasNextPage/endCursor` + `after` cursor for forward pagination.
- W3C WCAG 2.2 — current recommended WCAG line; includes Focus Not Obscured, Target Size and Accessible Authentication additions.
- MeitY Digital Personal Data Protection Rules, 2025 Gazette — phased commencement; most operational rules begin eighteen months after publication.
- CERT-In Directions under Section 70B and FAQs — incident/reporting/log obligations may apply to covered entities; exact applicability requires qualified Indian advice.
- Commercial context: sellerboard current feature set and Link My Books ecommerce-accounting/bank matching were used only to assess commodity vs differentiated product capabilities.

---

## 13. Full 118-row first-pass register — second-pass disposition

This appendix ensures no first-pass point silently disappears. A row can be a defect, strength, corrected statement, consolidated symptom, deferred optimization or audit-only cleanup.

| ID | Raw severity | Finding | Final disposition |
|---|---:|---|---|
| SEC-01 | P1 | Admin OTP recovery can downgrade admin password policy | CONFIRMED / CONSOLIDATED into **P1-A Credential policy + KDF migration**. |
| SEC-02 | P1 | Password KDF is below current OWASP work factor guidance | CONFIRMED / CONSOLIDATED into **P1-A Credential policy + KDF migration**. |
| SEC-03 | P1 | Current password verifier prevents gradual KDF migration | CONFIRMED / CONSOLIDATED into **P1-A Credential policy + KDF migration**. |
| SEC-04 | P2 | Sessions have a 30-day absolute lifetime but no idle timeout | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-05 | P2 | Session cookie can be hardened with a __Host- prefix | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-06 | P2 | Same-origin check accepts requests with no Origin header | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-07 | P2 | CSP still allows unsafe-inline and broad third-party origins | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-08 | P2 | No adaptive bot challenge is implemented | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-09 | P2 | D1 is used as the primary rate-limit counter | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-10 | P3 | Entitlement verification has no dedicated rate limit | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| SEC-11 | P2 | Rate-limit coverage is inconsistent across authenticated mutations | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-12 | P3 | Logout route lacks the common same-origin guard | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| SEC-13 | P1 | No repository-native security automation or SBOM pipeline | CONFIRMED / CONSOLIDATED into **P1-B CI + supply-chain + release provenance**. |
| SEC-14 | P2 | Admin identity is environment allowlist based, without dedicated MFA/role record | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-15 | P2 | Connector credentials use AES-GCM and versioned key rotation, but master-key custody is app-secret based | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-16 | P3 | WooCommerce SSRF defense is strong but DNS validation/fetch resolution can diverge | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| SEC-17 | P2 | Some large JSON import routes parse entire request before enforcement | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEC-18 | P2 | Security events exist, but a formal security event taxonomy and alerting loop is incomplete | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PAY-01 | P1 | Razorpay webhook performs provider reconciliation synchronously before 2xx | CONFIRMED / CONSOLIDATED into **P1-C Durable async processing**. |
| PAY-02 | P1 | Razorpay API helper has no timeout or bounded retry policy | CONFIRMED / CONSOLIDATED into **P1-D Provider network resilience**. |
| PAY-03 | P1 | One-time order creation has no network timeout | CONFIRMED / CONSOLIDATED into **P1-D Provider network resilience**. |
| PAY-04 | P1 | Concurrent order requests can create multiple Razorpay orders for one analysis | CONFIRMED / CONSOLIDATED into **P1-E Payment idempotency + concurrency**. |
| PAY-05 | P2 | Scheduled billing reconciliation is newest-first and can starve older unresolved records | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PAY-06 | P2 | Billing reports are capped without paging/cursor in the admin operation | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PAY-07 | P1 | No durable Cloudflare Queue/Workflow for payment and subscription event processing | CONFIRMED / CONSOLIDATED into **P1-C Durable async processing**. |
| PAY-08 | P3 | Ambiguous provider timeout/retry states need explicit user-facing recovery | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| PAY-09 | P2 | Webhook contract tests do not replace provider/D1 concurrency integration tests | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PAY-10 | P3 | Captured-state and amount/currency/order verification are correctly enforced | STRENGTH — retain and regression-test; not an implementation gap. |
| CON-01 | P1 | Official API sync is hard-limited to a 1–30 day window | CONFIRMED / CONSOLIDATED into **P1-F Connector completeness + backfill**. |
| CON-02 | P1 | WooCommerce sync stops after five 100-row pages | CONFIRMED / CONSOLIDATED into **P1-F Connector completeness + backfill**. |
| CON-03 | P1 | Shopify order sync stops after five 50-order pages | CONFIRMED / CONSOLIDATED into **P1-F Connector completeness + backfill**. |
| CON-04 | P1 | Shopify Payments transactions and payouts fetch only the first 100 each | CONFIRMED / CONSOLIDATED into **P1-F Connector completeness + backfill**. |
| CON-05 | P1 | Amazon Orders/Finances use bounded page loops rather than exhaustive pagination | CONFIRMED / CONSOLIDATED into **P1-F Connector completeness + backfill**. |
| CON-06 | P2 | Flipkart pull sync has a fixed ten-page ceiling | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| CON-07 | P1 | Manual sync endpoint immediately processes the queued job synchronously | CONFIRMED / CONSOLIDATED into **P1-C Durable async processing**. |
| CON-08 | P1 | Provider-aware retry/backoff/rate-limit control is incomplete | CONFIRMED / CONSOLIDATED into **P1-D Provider network resilience**. |
| CON-09 | P2 | Connector enqueue has SELECT-then-INSERT duplicate-job race | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| CON-10 | P2 | Current cron worker handles only three due connector jobs per five-minute tick | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| CON-11 | P2 | Shopify webhooks are not used to reduce polling and improve freshness | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| CON-12 | P2 | Flipkart Notification Service is not integrated | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| CON-13 | P2 | WooCommerce asks for API keys instead of using WooCommerce application authorization | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| CON-14 | P2 | Shopify API version is current but lacks an automated quarterly compatibility process | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| CON-15 | P2 | Amazon uses current Orders and Finances API generations | STRENGTH: Amazon Orders v2026-01-01 and Finances v2024-06-19 generations are already used. Do not spend a phase migrating API generation; fix pagination/completeness instead. |
| CON-16 | P2 | No provider sandbox/recorded contract suite for API schema drift | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| CON-17 | P1 | Truncation is communicated as warnings but not elevated to a first-class completeness contract | CONFIRMED / CONSOLIDATED into **P1-F Connector completeness + backfill**. |
| CON-18 | P2 | OAuth state and encrypted credential architecture is strong | STRENGTH — retain and regression-test; not an implementation gap. |
| DB-01 | P1 | Drizzle schema is materially behind production migrations | CONFIRMED / CONSOLIDATED into **P1-G Schema authority + migration parity**. |
| DB-02 | P2 | Raw-SQL triggers are not represented in the TypeScript schema model | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| DB-03 | P2 | No automated representative production-snapshot upgrade test | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| DB-04 | P2 | D1 Time Travel exists platform-side but restore drills/runbook are not in repo | CORRECTED: backup/restore runbook exists. Remaining gap is proof of a completed non-production restore drill plus automated evidence. |
| DB-05 | P2 | No explicit capacity alarms for D1 size/query/write pressure | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| DB-06 | P3 | Read replication should not be enabled without measured need | DEFER: do not add D1 read replication until measured read pressure/latency justifies it. |
| DB-07 | P2 | Operational cleanup exists but financial/audit retention is intentionally undefined | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| DB-08 | P3 | Account export has a 100,000-row hard limit and manual support fallback | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| DB-09 | P2 | Immutable/revision-aware financial lineage is unusually strong for this stage | STRENGTH — retain and regression-test; not an implementation gap. |
| UI-01 | P1 | Mobile blog CSS overrides 16:9 hero and can crop the actual image content | CONFIRMED / CONSOLIDATED into **P1-I Production-critical E2E gates**. |
| UI-02 | P2 | Blog tables are not explicitly horizontally scrollable on narrow screens | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-03 | P2 | Global UI language and article language are separate state machines | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-04 | P2 | Bilingual article title/subtitle/metadata remain shared | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-05 | P2 | No automated WCAG/axe regression suite | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-06 | P2 | Sticky header needs Focus Not Obscured verification | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-07 | P3 | Language toggle mobile targets are 36px high, above WCAG minimum but below the project’s stronger mobile tap target practice | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| UI-08 | P2 | No visual regression baseline for responsive UI | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-09 | P2 | E2E runs Desktop Chrome and Pixel 5 only | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-10 | P2 | Glass/backdrop filters remain GPU-heavy on low-end phones | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-11 | P3 | Article read-time is one shared value, not language-specific | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| UI-12 | P2 | Async connector/billing status needs resilient progress/recovery UX as work moves off-request | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| UI-13 | P3 | Reduced-motion support and visible focus treatment already exist | STRENGTH — retain and regression-test; not an implementation gap. |
| PERF-01 | P1 | No real-user Core Web Vitals measurement | CONFIRMED / CONSOLIDATED into **P1-I Production-critical E2E gates**. |
| PERF-02 | P2 | Heavy analysis/export dependencies produce >500kB chunks | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PERF-03 | P2 | No automated performance budget in CI | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PERF-04 | P2 | Large normalized imports can create long browser/Worker work on low-end hardware | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PERF-05 | P3 | Blog hero is marked `unoptimized` | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| PERF-06 | P3 | Introduce caching only from measured route semantics, not globally | DEFER/MEASURE: do not add broad caching without route-by-route semantics and measurements. |
| SEO-01 | P2 | Same-URL body toggle is not full multilingual search architecture | REFINED: same-URL toggle is valid UX. Separate language URLs + hreflang are a growth phase only if bilingual organic discoverability is a priority. |
| SEO-02 | P2 | Root `<html lang>` is one global admin locale while article may default Hindi | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEO-03 | P2 | SEO diagnostics are not fully per-language | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEO-04 | P3 | `keywords` metadata is maintained even though Google does not use meta keywords for ranking | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| SEO-05 | P2 | Generative-AI visibility should be measured, not chased with AEO/GEO hacks | REFINED: keep foundational SEO and measure Search Console generative-AI visibility; do not treat llms.txt/AEO/GEO tactics as ranking requirements. |
| SEO-06 | P2 | Global crawler/indexing toggles are powerful and need stronger change safety | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEO-07 | P3 | Static sitemap entries should carry meaningful last-modified data where available | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| SEO-08 | P2 | News/video hubs and sitemaps must remain gated when inventory is thin | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEO-09 | P2 | Editorial policy, author entity, review date and sources are strong trust signals | STRENGTH — retain and regression-test; not an implementation gap. |
| SEO-10 | P2 | Search Console/IndexNow/AI visibility is not tied to a measurable operational dashboard in repo | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| SEO-11 | P3 | Preferred-source deeplink is valid fallback; official button can be considered | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| SEO-12 | P2 | Article/organization/site/video/news structured data coverage is broad | STRENGTH — retain and regression-test; not an implementation gap. |
| OPS-01 | P1 | No automated CI pipeline exists in the repository | CONFIRMED / CONSOLIDATED into **P1-B CI + supply-chain + release provenance**. |
| OPS-02 | P1 | Workers native observability is not enabled in Wrangler config | CONFIRMED / CONSOLIDATED into **P1-H Observability + SLOs**. |
| OPS-03 | P2 | Release ID is stale static text | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| OPS-04 | P1 | No SLO/error-budget/alert definitions | CONFIRMED / CONSOLIDATED into **P1-H Observability + SLOs**. |
| OPS-05 | P2 | No `vinext check` compatibility gate despite vinext being beta | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| OPS-06 | P1 | E2E suite covers only a handful of product flows | CONFIRMED / CONSOLIDATED into **P1-I Production-critical E2E gates**. |
| OPS-07 | P2 | No visual/mobile snapshot tests | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| OPS-08 | P2 | No automated accessibility tests | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| OPS-09 | P2 | No chaos/failure-injection suite for provider timeouts, 429s and partial failures | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| OPS-10 | P2 | No disaster-recovery rehearsal is encoded | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| OPS-11 | P2 | Operational admin screens exist, but incident runbooks are fragmented | REFINED: runbooks are present, but need one operational index, owners, escalation contacts and drill evidence. |
| OPS-12 | P2 | Health endpoint should evolve into dependency/readiness diagnostics without leaking secrets | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| OPS-13 | P3 | README architecture is stale compared with production | LOWER PRIORITY cleanup/optimization; do after measured P1/P2 work unless it blocks a specific user flow. |
| OPS-14 | P2 | Legacy AWS S3 code/env surface remains alongside native R2 | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| OPS-15 | P3 | Audit packaging script included `test-results/` in the ZIP | REMOVE FROM PRODUCT ROADMAP: audit-package hygiene issue only; not a production product defect. |
| OPS-16 | P2 | No protected automated deployment pipeline/approval record in repo | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PRIV-01 | P2 | Privacy-by-design implementation is strong; legal retention matrix remains incomplete | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PRIV-02 | P2 | DPDP operational requirements should be prepared before phased commencement | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PRIV-03 | P2 | CERT-In log-retention applicability needs counsel/qualified assessment | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PRIV-04 | P2 | No full breach-response playbook is visible | CORRECTED: a baseline incident-response runbook exists. Remaining gap is regulatory/provider contacts, breach decision matrix, notification ownership and exercised tabletop evidence. |
| PRIV-05 | P3 | Account export deliberately excludes connector secrets | STRENGTH — retain and regression-test; not an implementation gap. |
| PRIV-06 | P2 | Deletion workflow is thoughtful but retained-category justification must be policy-backed | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PRIV-07 | P2 | No machine-readable/vendor processor inventory is visible | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| PRIV-08 | P3 | Benchmark contribution is explicit opt-in in schema | STRENGTH — retain and regression-test; not an implementation gap. |
| ARCH-01 | P2 | Browser-local raw-file analysis boundary is strong | STRENGTH — retain and regression-test; not an implementation gap. |
| ARCH-02 | P2 | Financial logic is separated into parser/normalization/reconciliation/decision layers | STRENGTH — retain and regression-test; not an implementation gap. |
| ARCH-03 | P2 | Tenant/RBAC and cross-tenant integrity controls are extensive | STRENGTH — retain and regression-test; not an implementation gap. |
| ARCH-04 | P2 | Durable async execution is the largest architectural maturity gap | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| ARCH-05 | P3 | Microservices are not justified yet | STRENGTH/DECISION: remain a modular monolith; microservices are not justified by current evidence. |
| ARCH-06 | P2 | Marketplace write automation should remain disabled until stronger controls exist | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| ARCH-07 | P2 | Parser/engine versions are saved, but release/version provenance is not unified end-to-end | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |
| ARCH-08 | P2 | Admin-manageable SEO/trial/content controls reduce hardcoding, but high-impact controls need governance | RETAIN as P2 hardening/governance backlog; implement in its grouped F15–F20 workstream. |

---

## 14. Final engineering position

The correct next move is **not another broad feature sprint**. SellerHisab already has enough surface area. The highest leverage is to make the existing financial truth engine operationally trustworthy under concurrency, high-volume pagination, provider failure and production incidents.

If F15–F18 are executed cleanly, the architecture becomes materially harder to break and much easier to scale. F19–F20 then turn that reliable core into a measurable multilingual growth system with defensible operations/compliance. Only after that should F21-scale architecture or broad new product categories be considered.

**One-line final direction:** preserve the modular monolith and privacy/evidence moat; make schema, async execution, connector completeness, provider idempotency, observability and release tests boringly reliable before expanding breadth.
