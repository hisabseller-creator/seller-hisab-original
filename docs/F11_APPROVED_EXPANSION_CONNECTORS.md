# SellerHisab F11 — Approved Expansion Connectors

F11 turns the reserved WooCommerce connector into the first P1 live commerce expansion connector.

## Live in F11
- WooCommerce REST API `wc/v3` order read sync.
- Merchant provides a public HTTPS store URL plus a WooCommerce Consumer Key/Secret generated with **Read** permission.
- Keys are sent to SellerHisab only over the signed-in same-origin endpoint and encrypted at rest with the existing connector encryption layer.
- The Consumer Secret is sent in the HTTPS Basic Authorization header to the merchant's own store, never placed in URL query parameters.
- Server-side target validation rejects HTTP, localhost/local/internal/test hosts, literal IPv6 targets, private/reserved IPv4 ranges and non-443 custom ports; redirects are rejected.
- Only order ID/number/status/date/currency and line ID/SKU/quantity/line total enter the mapper. Customer billing/shipping/email/phone are ignored.
- SKU-less/custom lines fail closed instead of being guessed.
- Sync is bounded to 5 x 100 order pages per run.
- WooCommerce payment-gateway payout/settlement is **not inferred** from order data.

## Governance
- Owner/Admin can connect or disconnect credentials.
- Analyst can run read sync, consistent with F10 data-write capability.
- Viewer remains read-only.
- No WooCommerce write endpoint, webhook creation, order mutation, product mutation, PO, stock transfer, bid or budget write is added.

## No migration
F11 reuses the F6 connector/account/credential/sync schema and F10 workspace governance. It deliberately adds no D1 migration. Deployment must stop if any migration is pending.
