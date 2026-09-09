# SellerHisab F3 — P0 Marketplace Live File Analysis

F3 makes the four P0 channels usable in the normal `/analyze` product through supported seller-exported files while keeping the website-first login/admin model unchanged.

## What is live

### Meesho
- Existing validated Payments / Payments-to-Date file analysis remains live.
- Existing Orders, returns/RTO and Ads support remains intact.

### Amazon India
- Orders export parser with stable `amazon-order-id` + SKU identity.
- Payments → All Statements → Settlement Flat File V2 parser.
- Settlement V2 rows are grouped to source-backed order-level net settlement evidence.
- Settlement ID / total / deposit date are preserved as payout-batch evidence when present.
- Refund-linked rows are surfaced as return adjustments instead of silently treated as sales.
- Tab-delimited `.txt` / `.tsv` files are accepted directly.

### Flipkart
- Orders report parser with stable Order Item ID + SKU identity.
- Settlement / P&L file parser for explicit line-level or order-level settlement amounts.
- Unit Selling Price is multiplied by quantity; explicit total-order-item values are not multiplied again.
- Unknown or ambiguous layouts fail closed rather than guessing a financial column.

### Shopify
- Documented Orders CSV parser.
- Documented Shopify Payments balance-transactions CSV parser.
- The `Net` amount is used as order-level marketplace financial evidence.
- Order-level Net is allocated across known Shopify order lines by observed line sales.
- Fulfilled + paid orders can become confirmed once released financial evidence and required costs exist.

## File formats
- XLSX
- XLS
- CSV
- TSV
- TXT
- ZIP containing supported files

Evidence-only XLSX sheets are retained; they are not discarded merely because they do not contain line-level events.

## Important scope boundary

`File analysis live` does not mean a marketplace account is API-connected.

- Amazon SP-API auto-sync still requires seller/developer authorization.
- Flipkart Reports API auto-sync still requires the relevant partner/third-party authorization.
- Shopify API auto-sync still requires app/store authorization.

F3 does not ask for or store marketplace passwords, OTPs or session cookies.

## Safety
- Strong report fingerprints are required.
- Unknown/changed schemas fail closed.
- Stable marketplace identifiers are required before money is linked.
- Order revenue is not silently treated as settlement cash.
- Raw seller report rows stay in the browser analysis flow.
- Existing login return flow, MSG91 verified-identity fix, `/app` account utility and `/admin` Users & Purchases behavior are preserved.

## Database

No D1 migration is required.
