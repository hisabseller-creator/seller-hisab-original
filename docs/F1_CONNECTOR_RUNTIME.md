# SellerHisab F1 — Connector Runtime

## Goal
F1 begins the real data-connectivity layer without making false marketplace claims.

The file parser is no longer a generic "guess columns and calculate" pipeline. It now routes tabular reports through a marketplace connector fingerprint first.

## Live today
- Meesho file connector (`meesho-file-v1`)

## Recognized but deliberately blocked
- Amazon India (`amazon-in-v1`)
- Flipkart (`flipkart-v1`)
- Shopify (`shopify-v1`)

For these channels SellerHisab can identify strong report fingerprints or an explicit marketplace filename, record a normalized schema fingerprint, and stop with `connector_not_ready`. It does **not** reuse Meesho aliases to manufacture a result.

## Safety rules
1. No validated connector match => fail closed.
2. Recognized but disabled connector => fail closed with marketplace-specific message.
3. A supported Meesho bundle mixed with an unsupported marketplace file => entire calculation stops.
4. Every supported report records a schema fingerprint and connector/adapter identity.
5. Meesho ads are channel-scoped at ingestion so identical SKUs on another marketplace cannot receive Meesho ad cost.
6. No marketplace password automation, portal scraping or hidden browser bot was added.

## Why schema fingerprints matter
Marketplace exports change columns over time. The normalized header fingerprint lets SellerHisab identify a previously validated schema and detect drift before money calculations silently change.

## Next F1 steps
1. Obtain real seller-export fixtures for Amazon India, Flipkart and Shopify.
2. Redact customer PII and preserve only the minimum columns needed for parser tests.
3. Build marketplace-specific mapping adapters from those fixtures.
4. Enable a connector capability only after fixture tests pass.
5. Add Shopify OAuth/API only after app credentials, scopes and redirect configuration are ready.
