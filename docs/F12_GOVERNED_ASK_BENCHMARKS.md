# F12 — Governed Ask SellerHisab + Benchmarks

F12 adds `/app/ask` as an evidence-first decision layer over SellerHisab's tenant-scoped ads, inventory, cash, connector-health and governed-action data.

## Ask SellerHisab V1

The V1 engine is deterministic and evidence-bound. It classifies supported operational questions and builds answers from normalized SellerHisab evidence. It does not send seller data to a third-party generative AI provider and does not invent an answer for unsupported questions.

Supported domains:

- What should I do today / top governed actions
- Ads / ACoS / ROAS / modeled sustainable spend
- Inventory / stockout / reorder / overstock
- Cash / payout-to-bank risk
- Connector health
- Missing-data coverage
- Privacy-qualified benchmarks

Every answer includes an explicit confidence score, evidence cards, data gaps, a boundary statement, and existing governed action links where applicable. Approval-required actions still require Owner/Admin approval in `/app/workspace`. Ask SellerHisab cannot execute bids, budgets, orders, purchase orders, transfers, payouts or marketplace writes.

## Query privacy

The free-form question is used in memory for the request and is not persisted as plain text. The audit event stores the classified intent, a SHA-256 hash of the normalized question, evidence count and confidence. This preserves traceability without retaining the user's question text.

## Benchmarks

Benchmark contribution defaults to OFF. Only an Owner/Admin can opt a workspace in or out.

Eligible cohort metrics in F12:

- Actual ACoS
- Inventory stockout rate among positions with reported 30-day sales
- Payout cash-at-risk rate

SellerHisab returns only aggregate cohort medians. A metric is hidden unless at least 20 opted-in businesses have that normalized metric. The UI returns only a coarse cohort-size band, never another tenant's ID, SKU, campaign, order, bank row, exact individual metric or raw source data.

F12 does not fabricate an "industry average" when the privacy threshold is not met.
