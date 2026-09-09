# F10 — Professional Workspace, Roles & Approvals

F10 turns the tenant foundation into a governed multi-user workspace without adding autonomous marketplace writes.

## Roles

- Owner: full workspace control, role management, connector management and approvals.
- Admin: operational administration, connector management and approvals; cannot create/demote/remove the owner.
- Analyst: tenant-scoped cash/ads/inventory imports, syncs, action assignment and approval requests.
- Viewer: read-only tenant-scoped visibility.

## Workspace invitations

Invites are email-bound, single-use and valid for seven days. SellerHisab stores only a SHA-256 hash of the invite token. F10 does not send invitation email; the owner/admin copies the generated link and shares it privately. Accepting an invite requires signing in with the invited email.

A user can belong to more than one workspace. `workspace_preferences` records the active tenant, and tenant-scoped cash/ads/inventory/connections follow that active workspace.

## Action workflow

F10 overlays governance on `action_recommendations` using `action_workflows`:

- assign an owner;
- request approval;
- owner/admin approve or reject;
- approval-required actions cannot be marked complete before approval;
- completion and all workflow changes are written to `audit_events`.

Ads review actions, cash review actions and cross-channel inventory reallocation default to approval-required because they can lead to money-moving decisions. SellerHisab still does not change bids, budgets, payouts, stock or purchase orders automatically.

## Scope boundary

F10 team access applies to tenant-scoped modules introduced by the multi-marketplace foundation: Connections, Bank & Cash, Ads & Marketing, Inventory and persisted tenant actions. Legacy saved analysis history and saved-cost records remain user-scoped and are not silently merged across teammates in F10.
