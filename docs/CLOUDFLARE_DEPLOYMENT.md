# Standalone Cloudflare Deployment

SellerHisab is a full-stack Cloudflare Workers application with D1. Deploy the source with Wrangler or a connected repository; it is not a static Pages upload.

## Requirements

- Node.js 22.13 or newer
- pnpm 11.19 or newer
- A Cloudflare account with Workers and D1 access

## Verify the source

From the project folder:

```bash
pnpm install
pnpm repo:check
pnpm prod:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

`prod:check` guards against accidentally reintroducing the removed demo/payment-simulator/development-OTP paths and verifies the production domain configuration.

## Cloudflare account and D1

```bash
pnpm cloudflare:login
pnpm cloudflare:whoami
pnpm db:remote
```

The existing production D1 binding is `DB`. `wrangler.jsonc` is the source of truth for that binding; do not add a duplicate `DB` binding in `vite.config.ts`.

## Production routing

`wrangler.jsonc` is configured with:

- `APP_ENV = production`
- `sellerhisab.com` as a Worker Custom Domain
- `www.sellerhisab.com` as a Worker Custom Domain

The Worker redirects `www.sellerhisab.com` to `https://sellerhisab.com`.

Canonical metadata and the sitemap use the fixed `https://sellerhisab.com` origin in `core/site-url.ts`. Do not introduce a build-time localhost/workers.dev canonical override.

## Secrets

Core account/security secrets:

```bash
pnpm exec wrangler secret put SESSION_SECRET
pnpm exec wrangler secret put ENTITLEMENT_SECRET
pnpm exec wrangler secret put MSG91_AUTH_KEY
pnpm exec wrangler secret put MSG91_WIDGET_ID
pnpm exec wrangler secret put MSG91_WIDGET_TOKEN
pnpm exec wrangler secret put ADMIN_EMAILS
```

Run `powershell -ExecutionPolicy Bypass -File .\scripts\check-production-readiness.ps1` to see core, AWS-media and Razorpay readiness separately.

## Deploy

```bash
pnpm deploy
```

Do not repeatedly redeploy to solve a DNS/TLS activation problem. If the source deploy succeeds but HTTPS handshakes fail, inspect Cloudflare **Workers & Pages → seller-margin-guard → Settings → Domains & Routes** and the zone/certificate status.

## Enable blog image uploads

Before using admin blog image upload, configure the private AWS S3 bucket and the required Worker secrets. Text-only blog publishing does not require an S3 upload.

## Enable real payments

The production runtime contains no payment simulator. Before enabling paid checkout:

1. Add Razorpay key ID, key secret and webhook secret.
2. Add the Starter and Pro Razorpay plan IDs.
3. Register `https://sellerhisab.com/api/payments/webhook`.
4. Verify one-time entitlement recovery, subscription activation, duplicate webhook delivery and refund/revocation behavior.
5. Confirm the displayed plan benefits match server-side entitlement enforcement.

Store secrets with `wrangler secret put`; never commit them.
