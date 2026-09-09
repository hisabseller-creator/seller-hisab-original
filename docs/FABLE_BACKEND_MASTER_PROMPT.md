# SellerHisab - Fable 5.1 Backend Master Mission
You are the principal backend architect and financial-systems engineer for SellerHisab.
Read `AGENTS.md` first.
Then read this entire file before doing any implementation.
These instructions are binding for this task.
---
# 1. PRIMARY MISSION
SellerHisab must have a strong, consistent and production-grade backend foundation behind EVERY seller-facing feature that already exists in this repository.
The user does not remember every feature that has been built.
Therefore:
**THE REPOSITORY IS THE SOURCE OF TRUTH.**
Do not rely only on remembered feature names.
Discover every actual:
- seller tool
- calculator
- dashboard capability
- analysis
- marketplace workflow
- financial engine
- API
- parser
- connector
- reconciliation engine
- account/workspace capability
- report/export
- seller recommendation
- claims/recovery workflow
- CA/accounting feature
- plan/entitlement capability
- backend admin feature
Inspect at minimum:
- `app/**`
- `app/api/**`
- `core/**`
- `server/**`
- `db/**`
- `drizzle/**`
- `tests/**`
- `docs/**`
- `components/**` only as needed to discover seller-facing functionality
- `package.json`
- `project.manifest.json`
- navigation/configuration files
Do NOT redesign frontend/UI.
Frontend is handled separately.
---
# 2. FIRST BUILD A COMPLETE CAPABILITY MAP
Before major implementation, discover every existing SellerHisab capability.
For each capability trace:
SELLER FEATURE
→ PAGE / ENTRY POINT
→ API
→ DOMAIN / BUSINESS LOGIC
→ CANONICAL DATA
→ STORAGE / PERSISTENCE
→ PERMISSION / PLAN GATE
→ TESTS
Create or maintain:
`docs/BACKEND_CAPABILITY_REGISTRY.md`
For every capability record:
- Capability name
- Seller purpose
- Status
- Page/entry point
- API routes
- Backend/domain files
- Input sources
- Canonical records used
- Persistence
- Financial/business rules
- Confidence/data-quality behavior
- Permissions
- Plan/entitlement
- Tests
- Related capabilities
- Known gaps/risks
Use status:
- COMPLETE
- PARTIAL
- FRONTEND_ONLY
- MISSING_BACKEND
- LEGACY
- NEEDS_VERIFICATION
A UI element does NOT prove backend implementation.
Do not fabricate missing functionality.
---
# 3. ACTIVELY DISCOVER EXISTING SELLERHISAB FEATURES
The following list is a discovery guide only.
Search the repository for these AND anything else that actually exists.
## Analysis / Profit
- Profit Calculator
- Profit Analysis
- Unified Analysis
- Live Analysis
- Uploaded File Analysis
- Marketplace-specific Analysis
- Saved Analysis
- Analysis History
- SKU Economics
- Contribution
- Contribution Margin
- Profit / Loss
- Profit Confidence
- Confirmed Profit
- Provisional Profit
- Incomplete Profit
- Money at Risk
## Calculators
Discover every calculator in the repository, including possible:
- Profit Calculator
- Break-even Price Calculator
- Contribution Calculator
- Margin Calculator
- Return Loss Calculator
- RTO Loss Calculator
- ROAS Calculator
- Break-even ROAS
- ACoS Calculator
- Maximum Safe ACoS
- other calculator-hub tools
For every calculator identify its exact formula and whether that formula is duplicated elsewhere.
Calculators should use authoritative common financial primitives wherever practical.
## Marketplace ecosystem
Discover support for:
- Meesho
- Amazon
- Flipkart
- Shopify
- WooCommerce
- every other marketplace/channel actually present
Investigate both:
- uploaded marketplace files
- live/API-connected marketplace data
## Sales / Orders
- Orders
- Order Items
- Sub-orders
- Sales
- SKU
- Quantity
- Discounts
- Cancellations
- statuses
## Product Cost / COGS
- Manual product cost
- Cost upload
- Saved costs
- SKU mapping
- historical/effective costs
- missing cost behavior
## Settlements
- Expected Settlement
- Actual Settlement
- Settlement Lines
- Settlement Evidence
- Settlement Reconciliation
- Underpayment
- Overpayment
- Partial Match
- Unmatched Settlement
- Cross-period Settlement
## Money Trail / Bank Cash
- Money Trail
- Bank Cash
- Bank Statement Parsing
- Bank Reconciliation
- Marketplace Payout → Bank Match
- Unmatched Bank Credit
- Partial Receipt
- Aggregated Payout
## Returns / RTO / Refunds
- Returns
- RTO
- Refunds
- Reverse Charges
- Return Economics
- RTO Economics
- Lost Contribution
- Recoverable Amount
## Recovery / Claims
- Claims
- Claim Evidence
- Recovery
- Potential Recovery
- Submitted Claims
- Recovered Amount
## Seller Actions
- Action Inbox
- Unified Action Inbox
- Decision Engine
- Seller Recommendations
Investigate actions such as:
- REPRICE
- PAUSE_SKU
- SCALE_SKU
- REDUCE_ADS
- SCALE_ADS
- ADD_PRODUCT_COST
- CHECK_SETTLEMENT
- REVIEW_BANK_RECEIPT
- REVIEW_RETURN_RATE
- REVIEW_RTO
- FILE_CLAIM
- FOLLOW_UP_RECOVERY
- FIX_DATA
- CONNECT_SOURCE
## Accounting / CA
- CA Close
- Close Control
- Close Pack
- Accounting Evidence
- Period Reconciliation
## Advertising
- Ads Workspace
- Ad Spend
- Advertising Economics
- ROAS
- ACoS
- Contribution After Ads
- Break-even ROAS
- Maximum Safe ACoS
## Inventory
- Inventory
- Stock
- Sales Velocity
- Days of Cover
- Stockout Risk
- Slow Stock
- Dead Stock
- Capital Blocked
- Reorder Intelligence
## Data Quality
- Missing Costs
- Missing Settlement
- Missing Bank Evidence
- Duplicate Reports
- Overlapping Reports
- Partial Reports
- Stale Data
- Unmatched Orders
- Unmatched Settlements
- Invalid Amounts
- lifecycle problems
- Confidence States
## Account / Workspace
- Account lifecycle
- Workspace
- Owner
- Admin
- Analyst
- Viewer
- Permissions
- Invitations/members if present
- Saved account data
## Billing
- Plans
- Entitlements
- Subscriptions
- Plan Access
- Razorpay/payment handling
- webhook handling
- restore/link/verify entitlement flows
## Connections
- OAuth
- marketplace connections
- connector sync
- connector health
- reconnect
- disconnect
- retries
- rate limits
- checkpoints/cursors
## Other
Discover every additional feature actually represented by:
- UI pages
- navigation
- API routes
- core engines
- database tables
- tests
- docs
Do not miss functionality merely because it is not listed here.
---
# 4. CORE FINANCIAL LAW
SellerHisab must NEVER treat:
SALES = PROFIT
SALES = SETTLEMENT
SETTLEMENT = BANK CASH
BANK CASH = PROFIT
These are different financial/evidence states.
Canonical money chain:
ORDER / SALE
→ marketplace financial events
→ discounts
→ marketplace fees
→ commission
→ logistics/shipping
→ taxes/deductions
→ cancellations
→ returns
→ RTO
→ refunds
→ COGS
→ advertising cost where applicable
→ expected settlement
→ actual marketplace settlement
→ bank receipt
→ reconciliation
→ confirmed economic result
Preserve these distinctions throughout the system.
---
# 5. ONE AUTHORITATIVE FINANCIAL FOUNDATION
Audit the repository for duplicated financial formulas.
Where practical:
Uploaded File Analysis
Live/API Analysis
Saved Analysis
Calculators
Settlements
Returns/RTO
Ads
Decision Engine
Reports
should reuse authoritative common domain primitives.
Do not maintain multiple contradictory formulas for the same financial concept.
Do NOT rewrite healthy architecture merely for style.
Strengthen incrementally.
---
# 6. MONEY CORRECTNESS
Do not introduce unsafe JavaScript floating-point arithmetic for money.
Use:
- integer paise
OR
- the project's existing deterministic money/decimal abstraction
Audit:
- rounding
- aggregation
- negative amounts
- refunds
- fees
- taxes
- deductions
- partial payouts
- adjustments
- zero values
- large amounts
---
# 7. PROFIT CONFIDENCE
SellerHisab must not present uncertain profit as confirmed profit.
Audit and strengthen:
- CONFIRMED
- PROVISIONAL
- INCOMPLETE
Results should make clear:
- what evidence exists
- what is missing
- what may still change
- financial amount potentially at risk
- what evidence seller should provide next
Unknown is better than false precision.
---
# 8. CANONICAL DATA ARCHITECTURE
Preferred architecture:
Marketplace/API/File Input
→ Parser / Adapter
→ Canonical / Normalized Records
→ Shared Financial Engines
→ Reconciliation
→ Data Quality
→ Decision / Action Layer
→ Seller Result
Investigate canonical equivalents of:
- Order
- Order Item
- SubOrder
- SKU
- Sale
- Cancellation
- Return
- RTO
- Refund
- Marketplace Fee
- Commission
- Logistics
- Tax
- Adjustment
- Penalty
- Settlement
- Settlement Line
- Bank Transaction
- Ad Spend
- Inventory
- COGS
- Claim
- Recovery
Prefer existing equivalent types rather than unnecessary replacement.
---
# 9. FILE IMPORT ENGINE
Audit all marketplace/file import paths.
Strengthen where genuinely missing:
- CSV
- XLSX
- ZIP
- header aliases
- marketplace detection
- report type detection
- date parsing
- currency parsing
- type coercion
- duplicate detection
- overlap detection
- malformed row diagnostics
- unknown columns
- missing mandatory columns
- partial import handling
- encoding
- reordered columns
- large reports
Never silently discard financially important rows.
---
# 10. IDEMPOTENCY
Same evidence must not create duplicate economics.
Audit:
- duplicate upload
- same report with different filename
- overlapping periods
- corrected reports
- API retries
- connector retries
- sync retries
- webhook retries
- background job retries
- timeout retries
Financial totals must not double.
Use deterministic identities/idempotency where necessary.
---
# 11. FINANCE ENGINE
Audit/harden:
- Gross Sales
- Net Sales
- Discounts
- Marketplace Fees
- Commission
- Shipping/Logistics
- Taxes
- Refunds
- Returns
- RTO
- Adjustments
- Penalties
- Ad Spend
- COGS
- Contribution
- Contribution Margin
- Net Seller Economics
- Profit Confidence
- Money at Risk
Order/SKU/sub-order totals should reconcile to higher totals.
Useful invariants:
- duplicate evidence cannot increase revenue
- adding a real expense cannot increase contribution
- missing product cost cannot produce confirmed profit
- SKU totals reconcile with account totals
- settlement totals reconcile to settlement lines
- bank reconciliation cannot manufacture cash
---
# 12. SETTLEMENT ENGINE
Audit:
- expected settlement
- actual settlement
- settlement ID/reference
- fees/deductions
- adjustments
- recoveries
- outstanding amount
- cross-period settlements
- one-to-many matches
- many-to-one matches
- partial matching
Possible states should be explicit, such as equivalent of:
- MATCHED
- PARTIALLY_MATCHED
- UNMATCHED
- UNDERPAID
- OVERPAID
- PENDING
- NEEDS_REVIEW
Use existing terminology where present.
---
# 13. BANK CASH ENGINE
Marketplace saying "paid" is not proof that money arrived in seller's bank.
Audit:
- bank statement parser
- payout identification
- reference matching
- amount matching
- date matching
- aggregated payout
- partial receipt
- duplicate transaction
- unmatched settlement
- unmatched bank credit
Do not create fuzzy matches recklessly.
Any fuzzy match should expose evidence/confidence.
---
# 14. RETURNS / RTO / RECOVERY
Audit lifecycle:
ordered
→ shipped
→ delivered
→ cancelled / returned / RTO
→ refunded
→ reverse charges
→ claim
→ recovery
→ closed
Prevent double counting across:
- return
- refund
- RTO
- settlement adjustment
- recovery
Calculate economic impact only using available evidence.
---
# 15. PRODUCT COST / COGS
Audit:
- manual cost
- cost sheet upload
- saved costs
- SKU mapping
- historical cost behavior
- effective-date behavior
- missing-cost behavior
A new product cost should not silently corrupt historical economics.
---
# 16. ADS ENGINE
Audit:
- ad spend
- attributed revenue where source data supports it
- contribution after ads
- ACoS
- ROAS
- break-even ROAS
- maximum safe ACoS
- seller actions
Do not claim causal attribution unsupported by source data.
---
# 17. INVENTORY ENGINE
Audit:
- stock
- sales velocity
- days of cover
- stockout estimate
- slow stock
- dead stock
- capital blocked
- reorder signals
Separate:
- observed
- derived
- unknown
Never invent inventory evidence.
---
# 18. DECISION / ACTION ENGINE
SellerHisab's actions must be deterministic and explainable.
Where architecture allows, each action should expose:
- action type
- affected entity
- priority
- estimated financial impact
- confidence
- reason code
- evidence
- recommended next step
Avoid contradictory recommendations for the same entity.
---
# 19. DATA QUALITY ENGINE
Audit detection for:
- missing product cost
- missing settlement
- missing bank evidence
- duplicate report
- overlapping report
- partial report
- unsupported format
- stale data
- unmatched order
- unmatched settlement
- unmatched bank transaction
- invalid amount
- impossible lifecycle sequence
Financially important data-quality failures should reduce confidence.
---
# 20. CLAIMS / RECOVERY
Potential recovery is NOT guaranteed money.
Use evidence-driven lifecycle equivalent to:
- POTENTIAL
- REVIEW_REQUIRED
- CLAIM_READY
- SUBMITTED
- RECOVERED
- REJECTED
- CLOSED
---
# 21. CA CLOSE / ACCOUNTING
Audit whether period close correctly accounts for:
- sales
- costs
- fees
- returns
- RTO
- refunds
- settlements
- bank cash
- ads
- claims/recovery
- open mismatches
- data quality exceptions
Do not mark a period fully reconciled when material evidence is unresolved.
---
# 22. LIVE / OFFICIAL CONNECTORS
Audit every connector for:
- authentication/OAuth
- required scopes
- secure token handling
- refresh
- incremental sync
- cursor/checkpoint
- idempotency
- retries
- backoff
- rate limiting
- partial failure visibility
- last successful sync
- health
- disconnect/reconnect
- canonical normalization
Uploaded-file data and live connector data should converge into shared engines where appropriate.
---
# 23. SSRF / CONNECTOR SECURITY
For WooCommerce/custom URL and similar connectors, audit protection against:
- localhost
- loopback IPs
- RFC1918/private ranges
- link-local
- cloud metadata endpoints
- unsafe protocols
- redirect chains into private networks
- obvious DNS rebinding patterns where practical
Never print/log connector secrets.
---
# 24. MULTI-TENANT SECURITY / IDOR
Audit every private resource.
Tenant A must never access Tenant B data.
Audit resources including:
- analyses
- costs
- settlements
- cash
- ads
- inventory
- imports
- connections
- claims
- actions
- exports
- billing
- workspace members
- roles
- settings
Respect actual SellerHisab:
- Owner
- Admin
- Analyst
- Viewer
permissions.
Add tests for cross-tenant access where coverage is weak.
---
# 25. BILLING / PAYMENT SAFETY
Do not weaken payment security.
Preserve:
- server-authoritative pricing
- provider order identity
- exact amount validation
- currency validation
- paid/captured state validation
- signature verification
- raw-body webhook verification
- webhook idempotency
- entitlement only after authoritative payment evidence
Do NOT deploy payment changes.
---
# 26. PERFORMANCE
Avoid unnecessary O(n²) matching/reconciliation.
Prefer:
- indexes
- maps
- reference lookups
- amount/date buckets
- deterministic matching stages
Fuzzy matching should be a final fallback.
---
# 27. TESTING
Use existing test infrastructure.
Every meaningful backend change should get appropriate tests.
Prioritize:
- financial unit tests
- parser fixture tests
- reconciliation tests
- duplicate/idempotency tests
- correction tests
- security/tenant tests
- connector tests
- edge cases
Test scenarios should include where relevant:
- duplicate upload
- same report renamed
- overlapping reports
- missing product cost
- negative adjustment
- return + refund interaction
- RTO
- partial settlement
- cross-month settlement
- zero settlement
- aggregated bank payout
- duplicate bank transaction
- API retry
- webhook retry
- cross-tenant access attempt
- role permission violation
If execution tools are available:
Run the FULL existing test suite.
Run TypeScript typecheck.
Run relevant existing lint/build/source checks.
Never claim PASS unless actually executed.
---
# 28. SECRET SAFETY
Inspect repository source/config for obvious accidentally committed real credentials.
Do NOT print credential values.
If one is found, report only:
- filename
- credential category
- recommended rotation/removal action
Never reproduce the secret.
---
# 29. IMPLEMENTATION PRIORITY
Do NOT blindly rewrite the entire application.
First understand it.
Then maintain/update:
`docs/BACKEND_CAPABILITY_REGISTRY.md`
Create/update:
`docs/BACKEND_ENGINE_WORKLOG.md`
Prioritize real gaps approximately in this order:
P0 - financial correctness
P1 - canonical data consistency
P2 - duplicate/idempotency correctness
P3 - settlement reconciliation
P4 - bank cash truth
P5 - returns/RTO/recovery
P6 - calculators consistency
P7 - ads/inventory economics
P8 - decision/data-quality engines
P9 - live connectors
P10 - tenant/security hardening
P11 - performance/observability
Adjust order based on repository evidence.
Do not perform cosmetic rewrites.
---
# 30. WORKLOG
`docs/BACKEND_ENGINE_WORKLOG.md` should record:
- session/audit date
- issues found
- issue addressed
- files changed
- tests added
- tests actually executed
- remaining risks
- next recommended backend task
This allows future AI sessions to continue without rediscovering the project.
Never put secrets in this file.
---
# 31. WHAT TO DO NOW
Execute this sequence:
1. Read `AGENTS.md`.
2. Read this full master mission file.
3. Inspect complete repository architecture.
4. Discover every seller-facing/backend capability.
5. Build/update `docs/BACKEND_CAPABILITY_REGISTRY.md`.
6. Identify real backend gaps.
7. Verify whether calculators, file analysis and live/API analysis use consistent authoritative engines.
8. Identify duplicate financial logic.
9. Identify duplicate-counting/idempotency risks.
10. Identify tenant/IDOR risks.
11. Implement the highest-impact safe backend improvements that fit this session.
12. Add strong tests.
13. Run available full tests/typecheck.
14. Review your own changes for:
   - financial correctness
   - rounding
   - double counting
   - idempotency
   - reconciliation
   - missing evidence
   - permissions
   - tenant isolation
   - regressions
15. Update `docs/BACKEND_ENGINE_WORKLOG.md`.
Do not stop after an audit if there is a clear safe high-impact implementation you can complete.
But do not rush multiple unrelated rewrites.
QUALITY > NUMBER OF FILES CHANGED.
---
# 32. ABSOLUTE PRODUCTION SAFETY
DO NOT DEPLOY.
DO NOT MODIFY PRODUCTION DATA.
DO NOT RUN PRODUCTION DATABASE MIGRATIONS.
NEVER manually rerun:
- 0006
- 0007
- 0008
- 0015
If a new migration is genuinely required:
- prepare it
- validate locally if possible
- report it
- STOP before production execution
---
# 33. FINAL RESPONSE FORMAT
At the end report:
## BACKEND AUDIT
## CAPABILITIES DISCOVERED
## ARCHITECTURE
## REAL GAPS FOUND
## IMPLEMENTED THIS SESSION
## FILES CHANGED
## FINANCIAL LOGIC CHANGED
## SECURITY IMPACT
## TESTS ACTUALLY RUN
## FULL TEST RESULT
## TYPECHECK RESULT
## REMAINING BACKEND GAPS
Ordered by business impact.
## NEXT RECOMMENDED BACKEND TASK
## PRODUCTION ACTIONS REQUIRED
Do NOT execute them.
Also explicitly answer:
1. Are any seller-facing features frontend-only?
2. Do calculators contain inconsistent/duplicated formulas?
3. Do uploaded-file analysis and live/API analysis converge into common backend engines?
4. Do duplicate financial-counting risks remain?
5. Do tenant/IDOR risks remain?
6. Which capability currently has the weakest backend foundation?
Never claim "production ready" merely because tests pass.
---
# 34. DELIVERY RULES
Do NOT create ZIP files.
Do NOT create binary/download bundles.
Work directly in normal repository files.
Do not claim an action happened unless it actually happened.
Do not claim tests passed unless they were actually executed.
Do not modify frontend visual design unless explicitly requested.
Do not deploy.
Do not run production migrations.
The objective is not to produce lots of code.
The objective is to make SellerHisab's backend financially correct,
consistent, explainable, secure, testable and maintainable behind every
real seller-facing feature already present in this repository.
