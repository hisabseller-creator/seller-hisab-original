# Access Review Procedure

## Purpose

This procedure defines how SellerHisab reviews and validates access to production systems, admin privileges, marketplace API credentials and sensitive data. It supports Amazon SP-API compliance and the security governance cadence in SECURITY_GOVERNANCE_POLICY.md.

## Scope

Every access surface listed below is reviewed quarterly by the Security Owner. An unscheduled review is triggered immediately after any SEV-1 or SEV-2 incident.

## Review surfaces

### 1. Admin identity allowlist — ADMIN_EMAILS and ADMIN_PHONES

| Item | Location | Action |
|---|---|---|
| `ADMIN_EMAILS` | Cloudflare Worker secret / `.dev.vars` | List every email; remove any identity that no longer requires admin access. |
| `ADMIN_PHONES` | Cloudflare Worker secret / `.dev.vars` | List every phone; remove any identity that no longer requires admin access. |

Verification: after any removal, confirm the removed identity receives HTTP 403 on `/api/admin/` routes. In production, an empty `ADMIN_EMAILS` and `ADMIN_PHONES` correctly disallows all admin access (`server/admin.ts` only permits the local-mode fallback when `APP_ENV=local`).

### 2. GitHub access

| Item | Action |
|---|---|
| Repository collaborators | List all collaborators on the SellerHisab repository; remove any who no longer contribute or have left the team. |
| GitHub Actions secrets | Verify no production secrets (Razorpay, MSG91, Amazon LWA, Cloudflare API tokens) are stored in GitHub Actions secrets. CI has no deploy or migration step by design (`.github/workflows/production-checks.yml`). |
| Branch protection rules | Verify `main` branch requires pull-request review before merge. |
| Unnecessary write access | Downgrade collaborators who only need read access from write/admin to read. |

### 3. Cloudflare access

| Item | Action |
|---|---|
| Dashboard members | List all members with access to the SellerHisab Cloudflare account; remove anyone who no longer requires it. |
| Dashboard roles | Verify each member has the minimum required role (e.g., read-only for monitoring, no Super Admin unless essential). |
| API tokens | List all active Cloudflare API tokens; revoke any that are unused, expired or overly permissioned. |
| Worker routes | Verify only `sellerhisab.com` and `www.sellerhisab.com` are configured as custom domains. |

### 4. Production secrets access

| Secret | Storage | Review action |
|---|---|---|
| `SESSION_SECRET` | Wrangler secret | Verify current, ≥32 chars, not shared outside authorized channels. |
| `ENTITLEMENT_SECRET` | Wrangler secret | Verify current, ≥32 chars, independent of SESSION_SECRET. |
| `CONNECTOR_ENCRYPTION_KEY` | Wrangler secret | Verify current, ≥32 chars. Check if key rotation to `_V2` is needed. |
| `RAZORPAY_KEY_SECRET` | Wrangler secret | Verify matches current Razorpay dashboard configuration. |
| `RAZORPAY_WEBHOOK_SECRET` | Wrangler secret | Verify webhook endpoint `https://sellerhisab.com/api/payments/webhook` is registered. |
| `AMAZON_LWA_CLIENT_SECRET` | Wrangler secret | Verify matches Amazon Developer Console. Confirm `AMAZON_SPAPI_DRAFT=false` in production. |
| `SHOPIFY_CLIENT_SECRET` | Wrangler secret | Verify matches Shopify Partner Dashboard. |
| `FLIPKART_CLIENT_SECRET` | Wrangler secret | Verify matches Flipkart developer console. |
| `AWS_SECRET_ACCESS_KEY` | Wrangler secret | Verify IAM user is scoped to the blog media S3 bucket with minimal permissions. |
| `MSG91_AUTH_KEY` | Wrangler secret | Verify matches MSG91 dashboard. Confirm allowed domains. |

Action: if any secret may have been exposed, rotate immediately and follow INCIDENT_RESPONSE.md.

### 5. Marketplace / API credentials

| Item | Action |
|---|---|
| Amazon SP-API app | Verify app roles/scopes in Amazon Developer Console match only what SellerHisab requires (read-only orders, finances). Remove unused scopes. |
| Shopify app | Verify approved scopes in Shopify Partner Dashboard. Confirm only `read_orders` (and approved payments scope if applicable). Review quarterly API version compatibility. |
| Flipkart app | Verify app approval status and notification signing contract. |
| Active seller connections | Query `connector_connections` for connections with `status = 'connected'`; verify each corresponds to a current authorized seller. |
| Stale connections | Identify connections that have not synced in 90+ days; consider prompting the seller to reauthorize or disconnect. |

### 6. Inactive accounts and unnecessary privileges

| Item | Action |
|---|---|
| Inactive admin accounts | Query `users` table for admin-allowlisted identities that have no `sessions` row created in the last 90 days. Remove from `ADMIN_EMAILS`/`ADMIN_PHONES` if access is no longer needed. |
| Inactive seller accounts | Query `users` for accounts with no session activity in 180+ days and `deleted_at IS NULL`. Flag for outreach or retention review (do not auto-delete). |
| Over-privileged workspace members | Query `tenant_members` for members with `role = 'owner'` or `role = 'admin'` who have not performed any audit-trailed action in 90+ days. Recommend downgrade to `analyst` or `viewer`. |
| Orphan tenants | Query `tenants` for workspaces where `owner_user_id` references a deleted or inactive user. Assign a new owner or flag for deletion review. |
| Stale OAuth states | Verify `connector_oauth_states` rows with expired TTLs are being cleaned by `pruneOperationalRetention`. |
| Expired sessions | Verify the retention job is running via the `15 2 * * *` cron and that expired `sessions` and `rate_limits` rows are being pruned. |

### 7. Evidence and sign-off

Each completed review must be recorded and signed off:

```
Review ID:              [sequential, e.g., AR-2026-Q3]
Review date:            YYYY-MM-DD
Reviewer:               [Name / Role]
Approver:               [Security Owner name / Role]
Surfaces reviewed:      [list of section numbers, e.g., 1–6]
Changes made:           [list of additions / removals / rotations, or "None"]
Inactive accounts found: [count and action taken, or "None"]
Privileges downgraded:  [count and details, or "None"]
Secrets rotated:        [list, or "None"]
Incidents since last review: [count and max severity, or "None"]
Next review due:        YYYY-MM-DD (current date + 90 days)
Reviewer signature:     ___________________  Date: ___________
Approver signature:     ___________________  Date: ___________
```

Store signed review records outside the public repository in restricted operational storage. Retain for at least 24 months.

## Escalation

- If a removed identity still has active sessions: revoke all sessions for that user immediately (`DELETE FROM sessions WHERE user_id = ?`) and record in the review.
- If an unknown Cloudflare member or GitHub collaborator is found: treat as SEV-2 and follow INCIDENT_RESPONSE.md.
- If a marketplace API scope exceeds what SellerHisab requires: remove the scope, re-test affected sync flows and record.
- If a production secret may have been exposed: rotate immediately, follow INCIDENT_RESPONSE.md, and if Amazon credentials are involved notify `security@amazon.com` within 24 hours.

## Reference

- SECURITY_GOVERNANCE_POLICY.md — governance framework and review cadence.
- INCIDENT_RESPONSE.md — incident handling including Amazon `security@amazon.com` 24h notification.
- AMAZON_DATA_HANDLING_POLICY.md — Amazon SP-API data classification and retention.
