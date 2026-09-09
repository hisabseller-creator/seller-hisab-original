# SellerHisab F4 — Returns / RTO / Profit Leakage / Recovery

F4 is one consolidated major phase. It does not create F4.1/F4.2 sub-phases.

## Product model preserved

- The normal SellerHisab website remains the product before and after login.
- `/app` remains a simple account/history/costs/billing utility.
- `/admin` remains the website + Users & Purchases admin area.
- MSG91 verified-identity authentication remains untouched.
- P0 live file analysis for Meesho, Amazon India, Flipkart and Shopify remains intact.
- Raw marketplace report rows stay browser-local in the analysis flow.

## What F4 adds

### 1. Return/RTO lifecycle intelligence

SellerHisab separates:

- completed returns,
- completed RTO,
- open return/RTO flows,
- normal/non-return orders.

Open-return amounts are shown as **exposure**, never as booked loss.

### 2. Normalized return causes

Imported reason text is normalized into explainable categories:

- size / fit,
- quality / damage,
- wrong item / variant,
- listing expectation mismatch,
- packaging,
- delivery / address,
- buyer refusal / changed mind,
- RTO / delivery failure,
- other,
- reason not supplied.

Specific evidence is preferred over broad keyword matches, and SellerHisab does not invent a cause when the source does not provide one.

### 3. Return/RTO economics

For completed return/RTO outcomes, observed loss can include:

- source-backed negative settlement cash impact,
- known packaging cost,
- known variable handling cost.

SellerHisab still does **not** invent product damage/write-off cost because returned inventory recovery condition is not known from ordinary marketplace reports.

### 4. Open-return liability / exposure

Open return flows surface money currently exposed while pickup, receipt, refund or final return status is unresolved. This is explicitly separate from confirmed loss.

### 5. SKU and channel risk

The analysis result now shows:

- return/RTO rate,
- completed return/RTO counts,
- open returns,
- observed loss,
- open exposure,
- safe-failure threshold where supportable,
- avoidable historical leakage above the safe threshold,
- leading observed cause,
- confidence,
- channel and SKU ranking.

### 6. Settlement recovery joined to leakage actions

Existing order-to-settlement-to-bank evidence is reused.

- short payout -> deterministic recoverable gap,
- missing/failed payout -> recoverable only when the reconciliation engine already supports that state,
- ambiguous/incomplete evidence -> review exposure only, not claimed recovery.

“Recoverable payout” is intentionally reserved for supportable payout evidence. Historical avoidable return/RTO leakage is treated as a prevention signal, not recoverable cash.

### 7. Money-ranked recovery/prevention actions

F4 can generate actions such as:

- Recover Settlement,
- Review Open Returns,
- Fix Packaging,
- QC / Supplier,
- Fix Listing,
- Reduce RTO,
- Review Return/RTO,
- Add Return Data.

Actions carry confidence, urgency and evidence-based money impact where supportable.

### 8. Signed-in persistence and alerts

Only privacy-safe aggregate metrics are added to the saved analysis summary:

- return/RTO count,
- observed return/RTO loss,
- open-return exposure,
- supportable payout recovery.

The account can surface alerts for open return exposure and payout recovery opportunities. Raw return rows/reasons are not uploaded by this summary flow.

### 9. Exports

Excel/PDF exports add:

- return/RTO headline metrics,
- Returns Recovery SKU sheet,
- Recovery Actions sheet,
- payout recovery context.

## Database

No D1 migration is required. Existing `analyses.summary_json` and `alerts` storage is reused.

## Safety / accounting rules

- Exposure != booked loss.
- Avoidable historical leakage != recoverable cash.
- Ambiguous payout evidence != claim amount.
- Unknown return reason stays unknown.
- Product damage cost is not guessed.
- Existing marketplace/API capability claims remain unchanged.
