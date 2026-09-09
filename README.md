# SellerHisab

Privacy-first multi-marketplace seller financial decision engine. Reports are parsed, normalized, reconciled and calculated inside the browser; raw marketplace rows are never posted to the application backend.

This is the complete editable source project. `README.md` is the starting point for development; deeper architecture, deployment and safety rules live under `docs/`. English is the first-visit default language; users can switch to Hinglish and their choice is saved on the device.

Version 1.4 uses an Indian-seller-first interface with a soft watercolor wallpaper and frosted surfaces. It includes account-aware navigation, five seller calculators, clear data-entry fields, a contact-led footer and a mobile-friendly D1-backed website admin. Production contains no public synthetic demo or payment simulator. English remains the first-visit default; Hinglish keeps English product terms in Latin script and Hindi text in Devanagari.

The product distinguishes source-backed **Confirmed Contribution**, unresolved **Provisional Contribution**, and **Incomplete** economics. It uses integer paise arithmetic and deterministic rules for actions, break-even price, return/RTO tolerance, ROAS and ACoS.

## What ships

- No-login XLSX, CSV and guarded ZIP analysis, including multiple files and periods
- Versioned header-fingerprint parser with fail-closed unknown-format handling
- Sub-order reconciliation, duplicate detection and source-row audit trails
- SKU/product/packaging/variable cost mapping by upload, paste or inline entry
- Web Worker analysis with cancellable, visible progress
- Free headline result, full deterministic Action Board and local simulators
- Browser-generated seven-sheet Excel workbook and PDF Action Report
- Intent-specific calculators, methodology and legal pages
- Profit, RTO loss, break-even price, Max ACoS and break-even ROAS calculator hub
- Password login by mobile/email, MSG91 Widget mobile OTP for registration/password reset, D1 metadata/history, Razorpay one-time and subscription flows
- Protected `/admin` website manager for hero copy, feature visibility, footer copy and official contact handles
- Server-verified signatures, webhook idempotency and anonymous signed entitlements
- Local IndexedDB costs/snapshots with a working Clear Local Data control

## Financial and privacy boundaries

The normalized core is framework-independent. It does not use an LLM for arithmetic. Money is stored as integer paise, deductions already reflected in settlements are not subtracted again, and presentation rounding happens only at the edge.

No API accepts a report file. Backend persistence is restricted to users, sessions, payment/entitlement metadata, derived analysis summaries/history, seller-profile metadata, alerts, site/blog content and support requests. Seller report rows and saved SKU costs remain browser-local in the current V1 implementation. Customer names, phone numbers, addresses, raw rows, order IDs, SKU names and seller monetary values are excluded from telemetry and server logs.

## Local setup

Prerequisites: Node.js 22.13+, pnpm, and a recent Chromium for Playwright.

```bash
cp .env.example .env.local
pnpm install
pnpm exec playwright install chromium
pnpm db:local
pnpm dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Registration and password reset use the configured MSG91 Widget. The application has no payment simulator; payment UI should not be exercised until Razorpay credentials are configured for the environment being tested.

## Required verification commands

```bash
pnpm install
pnpm fixtures
pnpm repo:check
pnpm prod:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm preview
pnpm deploy
```

The Vitest suite includes unit, property/invariant and golden parser tests. Playwright covers the real landing page, valid upload, fail-closed unknown format, source-backed audit drilldown, the free-result paywall boundary and current password/mobile-auth surfaces without invoking an external OTP or payment provider.

## Environment variables

Copy `.env.example`; do not place secrets in client-prefixed variables.

| Variable | Production requirement | Purpose |
|---|---:|---|
| `APP_ENV` | Yes | Set `production`; prevents development OTP exposure |
| `ENTITLEMENT_SECRET` | Yes | Signs anonymous paid-report entitlements |
| `SESSION_SECRET` | Yes | Protects persisted session-token hashes |
| `RAZORPAY_KEY_ID` | Payments | Public checkout key returned only with an order |
| `RAZORPAY_KEY_SECRET` | Payments | Server-only order and signature verification secret |
| `RAZORPAY_WEBHOOK_SECRET` | Payments | Server-only raw-body webhook HMAC secret |
| `RAZORPAY_STARTER_PLAN_ID` | Subscriptions | ₹99 plan configured in Razorpay |
| `RAZORPAY_PRO_PLAN_ID` | Subscriptions | ₹199 plan configured in Razorpay |
| `MSG91_AUTH_KEY` | Accounts | Server-side validation of MSG91 Widget access tokens |
| `MSG91_WIDGET_ID` | Accounts | MSG91 OTP Widget identifier |
| `MSG91_WIDGET_TOKEN` | Accounts | MSG91 Web Widget Token Auth |
| `PRICE_*_PAISE` | Recommended | Server-side pricing without a rebuild |
| `ADMIN_EMAILS` | Admin panel | Comma-separated emails allowed to manage public website settings |
| `ADMIN_PHONES` | Admin panel | Comma-separated mobile numbers (for example `919876543210`) allowed to manage public website settings |

## D1 and Cloudflare Workers deployment

This repository uses Cloudflare's vinext Workers path. For a standalone Cloudflare account:

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create seller-margin-guard
# Put the returned database_id in wrangler.jsonc; keep binding = "DB".
pnpm db:remote
pnpm exec wrangler secret put ENTITLEMENT_SECRET
pnpm exec wrangler secret put SESSION_SECRET
pnpm exec wrangler secret put MSG91_AUTH_KEY
pnpm exec wrangler secret put MSG91_WIDGET_ID
pnpm exec wrangler secret put MSG91_WIDGET_TOKEN
pnpm exec wrangler secret put RAZORPAY_KEY_SECRET
pnpm exec wrangler secret put RAZORPAY_WEBHOOK_SECRET
pnpm exec wrangler secret put ADMIN_EMAILS
pnpm build
pnpm deploy
```

See [docs/CLOUDFLARE_DEPLOYMENT.md](./docs/CLOUDFLARE_DEPLOYMENT.md) for the complete Windows-friendly test and production procedure. A full-stack Worker + D1 project is deployed with Wrangler or a connected Git repository; it is not a static drag-and-drop Pages folder.

Set non-secret runtime variables and remaining provider IDs in the Cloudflare Worker environment. Register the production webhook as `https://YOUR_HOST/api/payments/webhook` and subscribe to payment capture/failure and refund events. Run one test-mode purchase, verify the entitlement in D1, then switch to live Razorpay keys.

After signing in with an email listed in `ADMIN_EMAILS` or a mobile listed in `ADMIN_PHONES`, open `/admin`. Public content and contact settings are saved in D1; raw seller reports never enter the admin system.

The production Worker is configured for `sellerhisab.com` and `www.sellerhisab.com`; the Worker redirects `www` to the apex domain. Canonical metadata and sitemap URLs use the fixed production origin from `core/site-url.ts`, so a local `.env` value cannot accidentally publish a localhost or workers.dev canonical.

## Parser maintenance

Adapters live under `core/parsers/`; aliases and financial logic are intentionally separate. Add a synthetic fixture and expected normalized output before accepting a new report fingerprint. Never map an ambiguous monetary column by filename or position. Unknown required fields must continue to return the safe-stop message.

## Operational checks

See [docs/PRODUCTION_READINESS.md](./docs/PRODUCTION_READINESS.md) for the launch gate, privacy network inspection, payment checklist and external credentials still required for real payments.

## Developer documentation

- [Project structure](./docs/PROJECT_STRUCTURE.md)
- [Architecture and privacy boundaries](./docs/ARCHITECTURE.md)
- [Multi-marketplace foundation](./docs/MULTI_MARKETPLACE_FOUNDATION.md)
- [Cloudflare deployment](./docs/CLOUDFLARE_DEPLOYMENT.md)
- [Safe modification hints](./docs/DEVELOPER_HINTS.md)
- [UI design system and UX rules](./docs/UI_DESIGN_SYSTEM.md)
- [MSG91 mobile OTP setup](./docs/AUTH_MSG91_SETUP.md)
- [Production readiness checklist](./docs/PRODUCTION_READINESS.md)

Independent seller analytics utility. Not affiliated with or endorsed by any marketplace or commerce platform. Results are analytical estimates based on files and costs supplied by the seller; they are not tax, legal or accounting advice.


## Blog image storage (AWS S3)

Production blog media uses a private AWS S3 bucket. Set `AWS_S3_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` as Worker secrets. The IAM identity should be limited to `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on `arn:aws:s3:::YOUR_BUCKET/blog_*`. Public pages fetch images through the same-origin `/api/blog/media/<key>` route, so the S3 bucket does not need public access.

`www.sellerhisab.com` is redirected to `https://sellerhisab.com` by the Worker once both custom domains are attached.

## F1 connector runtime

The parser now routes every tabular marketplace report through an explicit connector fingerprint before normalization. Meesho remains the only live file analyzer. Amazon India, Flipkart and Shopify fingerprints are recognized but deliberately fail closed until real fixtures/approved connectors are validated. See `docs/F1_CONNECTOR_RUNTIME.md`.
