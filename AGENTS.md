# SellerHisab Engineering Instructions
SellerHisab is a multi-marketplace financial and operational intelligence
platform for Indian online sellers.

## Mandatory Continuity Protocol
Before doing any work, read in this order:
1. `AGENTS.md`
2. `docs/PROJECT_STATE.md`
3. `docs/AI_WORKLOG.md`

Treat the repository and current branch as the source of truth. If chat history,
a prior agent summary, or an old handoff conflicts with repository evidence,
follow the repository and record the discrepancy.

At the end of every meaningful work session:
- update `docs/PROJECT_STATE.md` to the new current checkpoint;
- append a concise entry to `docs/AI_WORKLOG.md`;
- record changed files, tests actually run, commit/push/deploy status,
  unresolved items, and the exact next action;
- never erase useful previous worklog history.

## Primary Agent Responsibility
Frontend/UI work is handled separately.
Focus on:
- backend architecture
- business/domain logic
- financial engines
- seller tools and calculators
- marketplace parsers
- canonical normalization
- uploaded-file analysis
- live/API analysis
- settlements
- bank cash reconciliation
- returns/RTO/refunds
- claims/recovery
- product costs / COGS
- ads economics
- inventory economics
- recommendation/action engine
- data-quality/confidence engine
- connectors and sync
- APIs
- persistence
- multi-tenant security
- permissions
- automated tests
- idempotency
- reliability
## Mandatory Feature Discovery
Do NOT rely only on feature names supplied by the user.
Inspect the repository and discover EVERY SellerHisab feature,
tool, calculator, workflow, engine, parser, API, connector and
seller/account capability that actually exists.
Trace every seller-facing capability:
Feature / page / entry point
-> API
-> domain/business logic
-> persistence/data source
-> permissions/entitlement
-> tests
Actively investigate things such as:
- Profit Calculator
- Profit Analysis
- Unified Analysis
- Live Analysis
- File Analysis
- Marketplace-specific analysis
- Sales
- Orders
- SKU economics
- Product Cost / COGS
- Contribution
- Margin
- Break-even calculations
- Settlements
- Settlement Reconciliation
- Money Trail
- Bank Cash
- Bank Reconciliation
- Returns
- RTO
- Refunds
- Recovery
- Claims
- Action Inbox
- CA Close
- Advertising economics
- Inventory economics
- Reports
- Exports
- Data Quality
- Confidence states
- Marketplace connections
- API sync
- Workspace/account functionality
- Roles/permissions
- Subscriptions/entitlements
- every other capability discovered in repository
The repository is the source of truth.
A frontend screen does NOT prove that backend functionality exists.
Mark capabilities honestly as:
- COMPLETE
- PARTIAL
- FRONTEND_ONLY
- MISSING
- NEEDS_VERIFICATION
Do not fabricate implementations.
## Financial Principles
SALES != SETTLEMENT != BANK CASH != PROFIT
Never collapse these states.
Economic results must preserve evidence/confidence such as:
- CONFIRMED
- PROVISIONAL
- INCOMPLETE
Unknown is better than false precision.
Use deterministic money calculations:
- integer paise
OR
- project's existing safe decimal abstraction
Never introduce unsafe binary floating-point money calculations.
Prevent:
- duplicate imports
- duplicate sync effects
- duplicate webhook effects
- duplicate financial counting
- inconsistent formulas
Marketplace-specific input should normalize into shared canonical
financial/domain engines wherever practical.
Recommendations/actions must be deterministic, evidence-backed and explainable.
## Multi-Tenant Security
Every private resource must remain tenant/workspace scoped.
Audit:
- IDOR
- cross-tenant access
- unsafe client-provided workspace IDs
- incorrect role permissions
## Production Safety
DO NOT DEPLOY.
DO NOT modify production data.
DO NOT execute production migrations.
NEVER manually rerun historical migrations:
0006
0007
0008
0015
If a new migration is genuinely necessary:
- prepare it
- validate it locally if possible
- report it
- DO NOT execute against production
Never expose or commit secrets.
Do not weaken:
- authentication
- authorization
- payment verification
- webhook verification
- tenant isolation
Do not redesign frontend/CSS unless explicitly asked.
## Engineering Approach
Before changing code:
1. understand existing architecture
2. map existing capabilities
3. identify real gaps
4. preserve healthy working modules
5. prioritize financial correctness
6. implement incrementally
7. add/update tests
8. run actual available tests/typecheck
9. review:
   - rounding
   - double counting
   - idempotency
   - reconciliation
   - missing evidence
   - tenant isolation
   - regressions
Never claim tests passed unless they were actually executed.
Never claim production readiness merely because tests pass.
