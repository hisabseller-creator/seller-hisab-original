# SellerHisab F6 — Official API Connections + Live Read Sync

F6 adds seller-authorized, read-only marketplace sync while preserving the website-first product and the existing F3 file-analysis paths.

## What is live in code

- **Amazon India** — public SP-API OAuth/LWA authorization, Orders API v2026-01-01 read sync, best-effort Finances v2024-06-19 and payout-group evidence. Orders can still sync when Finance and Accounting roles are not granted; SellerHisab then marks finance as partial instead of inventing settlement data.
- **Shopify** — standalone authorization-code OAuth with expiring offline access/refresh tokens, Admin GraphQL `2026-07` order sync, and optional Shopify Payments evidence only when the app/store has an approved payments read scope.
- **Flipkart** — third-party seller OAuth Authorization Code flow and Seller Order Management v3 read sync. Settlement remains validated-file-first; F6 does not assume a live payment API.
- **Meesho** — remains file-first. No public general seller API is claimed.

## Safety boundaries

- SellerHisab never asks for or stores marketplace passwords.
- Access/refresh tokens are encrypted at rest with AES-GCM using a server-only key.
- OAuth state is single-use, hashed in D1, user-bound, tenant-bound and expires after 10 minutes.
- Shopify callback HMAC is verified and the returned shop must match the shop that started OAuth.
- API order queries intentionally omit customer names, emails, phones and addresses.
- Sync writes privacy-safe normalized **API observations** to the immutable commerce ledger, not raw marketplace API payloads.
- No listing, price, inventory, order-status or advertising write automation is enabled in F6.
- Bounded pagination fails honestly with warnings rather than claiming full coverage after a safety limit is reached.

## Production callback URLs

Configure these exact callback URLs in the respective developer/app consoles:

- Amazon India: `https://sellerhisab.com/api/account/connections/callback/amazon`
- Shopify: `https://sellerhisab.com/api/account/connections/callback/shopify`
- Flipkart: `https://sellerhisab.com/api/account/connections/callback/flipkart`

`CONNECTOR_CALLBACK_ORIGIN` can override the origin for preview/local testing. Production defaults to `https://sellerhisab.com`.

## Server-side configuration

Never put real values in source control. Configure production secrets with `wrangler secret put`.

Required encryption secret:

- `CONNECTOR_ENCRYPTION_KEY` — high-entropy value of at least 32 characters.

Shopify:

- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_SCOPES` is optional; default is `read_orders`.
- Add `read_shopify_payments` or `read_shopify_payments_accounts` only after Shopify approves the relevant scope for the app.

Amazon:

- `AMAZON_SPAPI_APPLICATION_ID`
- `AMAZON_LWA_CLIENT_ID`
- `AMAZON_LWA_CLIENT_SECRET`
- `AMAZON_SPAPI_DRAFT=true` only while using an Amazon SP-API app that is still in Draft.

Flipkart:

- `FLIPKART_CLIENT_ID`
- `FLIPKART_CLIENT_SECRET`

Example command pattern (paste the value only into Wrangler's hidden prompt):

```powershell
pnpm exec wrangler secret put CONNECTOR_ENCRYPTION_KEY --config wrangler.jsonc
pnpm exec wrangler secret put SHOPIFY_CLIENT_ID --config wrangler.jsonc
pnpm exec wrangler secret put SHOPIFY_CLIENT_SECRET --config wrangler.jsonc
pnpm exec wrangler secret put AMAZON_SPAPI_APPLICATION_ID --config wrangler.jsonc
pnpm exec wrangler secret put AMAZON_LWA_CLIENT_ID --config wrangler.jsonc
pnpm exec wrangler secret put AMAZON_LWA_CLIENT_SECRET --config wrangler.jsonc
pnpm exec wrangler secret put FLIPKART_CLIENT_ID --config wrangler.jsonc
pnpm exec wrangler secret put FLIPKART_CLIENT_SECRET --config wrangler.jsonc
```

Do not paste secrets into chat, scripts, `.env.example`, Git, screenshots, or support messages.

## Database migration

F6 adds `drizzle/0009_connector_oauth_sync.sql` only. It creates:

- `connector_oauth_states`
- `connector_credentials`
- `connector_sync_runs`

The F6 runner applies pending migrations through Wrangler migration tracking **after** typecheck, lint, tests and build pass. It does not manually execute or rerun old migrations 0006, 0007 or 0008.

## UI behavior

`/app/connections` remains a simple account utility. It now supports:

- Connect official API
- Sync last 30 days
- Disconnect
- last sync coverage/counts
- degraded/partial permission warnings

The normal public website and `/analyze` remain the SellerHisab product. F6 does not turn `/app` into an ERP dashboard.

## Honest activation boundary

Shipping the F6 code does **not** make a provider account connected by itself. A card becomes truly connected only after:

1. SellerHisab's developer app credentials are configured server-side.
2. The marketplace has approved the app/roles/scopes required for that capability.
3. The seller completes the official authorization callback successfully.

Until then, F3 file analysis remains available and the UI reports API setup as unavailable rather than faking a connection.
