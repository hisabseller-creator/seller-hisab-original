# Production readiness checklist

## Automated release gate

- [x] `pnpm typecheck` passes in strict mode
- [x] `pnpm lint` passes without application warnings
- [x] Unit, property-based and golden fixture tests pass
- [ ] Chromium desktop and budget-Android Playwright projects pass
- [x] Production vinext build completes
- [ ] All D1 migrations apply cleanly to preview and production
- [ ] Hosted smoke test completes on the final saved version

## Financial correctness

- [ ] Fixture totals reconcile from source event → sub-order → SKU → analysis
- [ ] Missing required costs never contribute to Confirmed Contribution
- [ ] Duplicate files/events do not double-count revenue
- [ ] Settlement deductions are not subtracted twice
- [ ] Return/RTO thresholds are hidden when observations are insufficient
- [ ] Every visible monetary total opens a source-backed `Why?` breakdown
- [ ] Simulator output is labeled as scenario output, not an edited actual result

## Privacy and security

- [ ] Browser Network inspection shows no report bodies, rows, monetary values, SKUs or order identifiers leaving the device
- [ ] Unknown report formats fail closed before financial output
- [ ] ZIP traversal, nested archive, compression-ratio and expanded-size fixtures are rejected
- [ ] CSP has no `unsafe-eval`; HSTS, clickjacking and MIME-sniffing protections are present
- [ ] Cross-origin state-changing requests receive HTTP 403
- [ ] Formula-like user strings are neutralized in Excel/CSV exports
- [x] Production contains no deterministic OTP, public demo route or payment simulator
- [ ] Entitlement/session secrets are different, random and stored as Worker secrets
- [ ] Clear Local Data removes IndexedDB analyses and saved costs

## Payments and accounts

- [ ] Razorpay test order is created server-side
- [ ] Browser payment success is ignored until server signature verification succeeds
- [ ] Duplicate webhook delivery is idempotent
- [ ] Failed, cancelled, pending and refunded UI/status paths are exercised
- [ ] Refund revokes the one-time entitlement
- [ ] Starter/Pro plan IDs match the displayed server-side prices
- [ ] MSG91 mobile OTP send/verify, expiry, attempt limit and endpoint rate limits are verified
- [ ] Password login and OTP-verified password reset are verified

## Launch operations

- [ ] Pricing, support and refund policy match the merchant account configuration
- [ ] Contact requests are triaged from D1 without report attachments
- [ ] Parser/version fingerprints are visible in saved results
- [ ] `robots.txt`, sitemap, canonicals and structured data use the final hostname
- [ ] Mobile keyboard/focus flow and screen-reader table labels are checked
- [ ] Public routes meet the stated Lighthouse targets on the deployed build

## External values required before real payments

1. Razorpay live key ID, key secret and webhook secret.
2. Razorpay Starter and Pro subscription plan IDs.
3. MSG91 auth key, Widget ID/Token Auth and any required Indian Sender ID / DLT setup.
4. Two independent 32+ byte random secrets for entitlements and sessions.
5. Final domain: `sellerhisab.com` (already configured as the production Worker Custom Domain).

No marketplace credential, session cookie, report-storage bucket or customer-data integration is required.


## 2026-09 production audit additions

- [x] SellerHisab public branding and canonical fallback use `sellerhisab.com`.
- [x] Blog pagination is present and appears automatically when published regular posts exceed 8.
- [x] Blog article HTML is sanitized before storage; embedded images/scripts are not accepted.
- [x] Blog media has a real same-origin GET route.
- [x] Blog media storage uses private AWS S3 instead of the unavailable R2 binding.
- [x] Uploaded image bytes are signature-checked (JPG/PNG/WebP/GIF), not trusted only by MIME name.
- [x] `www.sellerhisab.com` redirects to the root domain.
- [x] Admin blog initial-load lint issue removed.
- [x] Expired rate-limit rows receive best-effort cleanup.
- [ ] Configure four AWS S3 Worker secrets.
- [x] Attach both `sellerhisab.com` and `www.sellerhisab.com` as Worker custom domains.
- [ ] Add Razorpay live credentials and plan IDs.
- [ ] Register `https://sellerhisab.com/api/payments/webhook` in Razorpay.
- [x] `APP_ENV=production` is deployed; paid provider routes remain unavailable until their live secrets are configured.
- [ ] Run final real-device registration, login, password reset, blog image upload, ₹49 report purchase, Starter subscription, Pro subscription and refund/revocation tests.

## Security and storage hardening

Before final production launch, verify the following behavior in preview:

- [ ] Password reset invalidates older sessions on other browsers/devices
- [ ] Analysis-history saves are rate-limited and retained to the newest 100 derived summaries per account
- [ ] Alert history is retained to the newest 200 alerts per account
- [ ] Seller-profile mutations are rate-limited
- [ ] Subscription verification is rate-limited
- [ ] Expired sessions are removed opportunistically without requiring a paid cron job

These limits are intentionally conservative. They reduce D1 growth and abuse risk without sending raw marketplace rows to the server.


## Backend ownership integrity

- [ ] A signed-in user cannot overwrite another user's saved analysis by reusing its analysis ID
- [ ] A paid entitlement token is validated against its exact entitlement row ID
- [ ] Payment verification preserves an existing account owner instead of replacing it
- [ ] An already-paid guest report cannot be restored using only its analysis ID
- [ ] Guest entitlement linking requires the signed entitlement token
- [ ] Cross-origin state-changing browser requests receive HTTP 403
- [ ] Public auth/payment/contact endpoints have both identity-specific and IP-wide abuse limits where applicable


## Production consistency gate

- [x] Canonical metadata and sitemap use the fixed `https://sellerhisab.com` origin.
- [x] Dead `isDemo`, development OTP preview and old Seller Margin Guard social placeholder code are removed.
- [x] `.env.example`, deployment docs and readiness scripts no longer describe a payment simulator.
- [ ] Current Playwright desktop and mobile projects pass after the production-consistency rewrite.
- [ ] Starter/Pro benefits are enforced server-side exactly as advertised.
- [ ] Razorpay captured-payment webhook recovery guarantees a recoverable one-time entitlement.


## Admin credential recovery

- Production admin ID is `owner@sellerhisab.com`.
- `pnpm admin:reset` rotates that account to a locally generated temporary password, revokes its existing sessions and refreshes the `ADMIN_EMAILS` Cloudflare allowlist.
- The temporary password is copied to the local Windows clipboard and is not printed to terminal output.
- After login, use **Website Admin → Security** to set the permanent password. The change-password endpoint verifies the current password, applies the stronger admin password policy, revokes older sessions and keeps the current browser signed in with a fresh session.


## PBKDF2 runtime compatibility

- [x] Password hashing uses 100,000 PBKDF2-SHA256 iterations, matching the deployed runtime's supported ceiling.
- [x] Encoded hashes with unsupported iteration counts fail closed instead of throwing a 503 during login.
- [x] Admin recovery resets `admin@sellerhisab.com` to a 100,000-iteration hash before login.
- Existing pre-launch hashes created with 210,000 iterations must be reset through the password-reset flow because the deployed runtime cannot derive them.
