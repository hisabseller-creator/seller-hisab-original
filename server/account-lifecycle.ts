import {portableData,POLICY_VERSION} from "@/core/privacy-export";
import type { SessionUser } from "./auth";
import { randomId, sha256 } from "./crypto";
import { cancelRazorpaySubscription } from "./razorpay";
import { getD1 } from "./runtime";

const EXPORT_HARD_LIMIT = 100_000;

async function allRows<T>(sql: string, bindings: unknown[] = [], pageSize = 2000): Promise<T[]> {
  const db = getD1();
  const rows: T[] = [];
  let offset = 0;
  while (rows.length <= EXPORT_HARD_LIMIT) {
    let stmt = db.prepare(`${sql} LIMIT ?${bindings.length + 1} OFFSET ?${bindings.length + 2}`);
    stmt = stmt.bind(...bindings, pageSize, offset);
    const page = await stmt.all<T>();
    const batch = page.results ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
    offset += batch.length;
  }
  throw new Error("Your export is too large for a single browser download. Contact support for a staged export.");
}

export async function buildAccountExport(user: SessionUser) {
  const db = getD1();
  const account = await db.prepare(`
    SELECT id, email, phone, name, city, terms_accepted_at AS termsAcceptedAt, created_at AS createdAt
    FROM users WHERE id = ?1 AND deleted_at IS NULL
  `).bind(user.id).first<Record<string, unknown>>();
  if (!account) throw new Error("Account not found.");

  const ownedTenants = await allRows<{ id: string; name: string; createdAt: string }>(
    "SELECT id, name, created_at AS createdAt FROM tenants WHERE owner_user_id = ?1 ORDER BY created_at",
    [user.id],
  );
  const memberships = await allRows<{ tenantId: string; role: string; createdAt: string }>(
    "SELECT tenant_id AS tenantId, role, created_at AS createdAt FROM tenant_members WHERE user_id = ?1 ORDER BY created_at",
    [user.id],
  );

  const tenantExports = [];
  for (const tenant of ownedTenants) {
    const tenantId = tenant.id;
    tenantExports.push({
      tenant,
      channelAccounts: await allRows("SELECT id, channel_id AS channelId, external_account_id AS externalAccountId, display_name AS displayName, region, currency, status, created_at AS createdAt, updated_at AS updatedAt FROM channel_accounts WHERE tenant_id = ?1 ORDER BY created_at", [tenantId]),
      imports: await allRows("SELECT id, channel_account_id AS channelAccountId, source_kind AS sourceKind, connector_id AS connectorId, parser_version AS parserVersion, original_file_name AS originalFileName, source_fingerprint AS sourceFingerprint, coverage_start AS coverageStart, coverage_end AS coverageEnd, status, issue_count AS issueCount, created_at AS createdAt, completed_at AS completedAt, failed_at AS failedAt, superseded_by_import_id AS supersededByImportId FROM data_imports WHERE tenant_id = ?1 ORDER BY created_at", [tenantId]),
      ledger: await allRows("SELECT id, channel_account_id AS channelAccountId, source_import_id AS sourceImportId, order_line_uid AS orderLineUid, semantic, amount_paise AS amountPaise, currency, occurred_at AS occurredAt, reversal_of_entry_id AS reversalOfEntryId, formula_version AS formulaVersion, created_at AS createdAt FROM commerce_ledger_entries WHERE tenant_id = ?1 ORDER BY created_at", [tenantId]),
      bankTransactions: await allRows("SELECT id, source_import_id AS sourceImportId, row_key AS rowKey, booked_at AS bookedAt, amount_paise AS amountPaise, direction, currency, reference, description, closing_balance_paise AS closingBalancePaise, source_row AS sourceRow, logical_key AS logicalKey, is_active AS isActive, superseded_at AS supersededAt, created_at AS createdAt FROM bank_transactions WHERE tenant_id = ?1 ORDER BY created_at", [tenantId]),
      ads: await allRows("SELECT id, source_import_id AS sourceImportId, row_key AS rowKey, report_date AS reportDate, channel_id AS channelId, campaign_name AS campaignName, campaign_id AS campaignId, ad_group_name AS adGroupName, sku, spend_paise AS spendPaise, attributed_sales_paise AS attributedSalesPaise, attributed_orders AS attributedOrders, clicks, impressions, currency, source_row AS sourceRow, logical_key AS logicalKey, is_active AS isActive, superseded_at AS supersededAt, created_at AS createdAt FROM ad_performance_rows WHERE tenant_id = ?1 ORDER BY created_at", [tenantId]),
      inventory: await allRows("SELECT id, source_import_id AS sourceImportId, row_key AS rowKey, snapshot_date AS snapshotDate, channel_id AS channelId, sku, master_sku AS masterSku, product_name AS productName, available_units AS availableUnits, inbound_units AS inboundUnits, units_sold_30d AS unitsSold30d, lead_time_days AS leadTimeDays, unit_cost_paise AS unitCostPaise, contribution_margin_bps AS contributionMarginBps, location, source_row AS sourceRow, logical_key AS logicalKey, is_active AS isActive, superseded_at AS supersededAt, created_at AS createdAt FROM inventory_position_rows WHERE tenant_id = ?1 ORDER BY created_at", [tenantId]),
      actions: await allRows("SELECT id, channel_account_id AS channelAccountId, target_type AS targetType, target_id AS targetId, action_type AS actionType, expected_impact_paise AS expectedImpactPaise, confidence_bps AS confidenceBps, evidence_json AS evidenceJson, status, created_at AS createdAt, updated_at AS updatedAt FROM action_recommendations WHERE tenant_id = ?1 ORDER BY created_at", [tenantId]),
      audit: await allRows("SELECT id, action, resource_type AS resourceType, resource_id AS resourceId, metadata_json AS metadataJson, created_at AS createdAt FROM audit_events WHERE tenant_id = ?1 ORDER BY created_at", [tenantId]),
      benchmarkPreference: await db.prepare("SELECT contribute_enabled AS contributeEnabled, updated_at AS updatedAt FROM benchmark_preferences WHERE tenant_id = ?1 LIMIT 1").bind(tenantId).first(),
    });
  }

  return portableData({
    policyVersion: POLICY_VERSION,
    exportVersion: "sellerhisab-account-export-v1",
    generatedAt: new Date().toISOString(),
    account,
    memberships,
    analyses: await allRows("SELECT id, profile_id AS profileId, label, summary_json AS summaryJson, parser_version AS parserVersion, engine_version AS engineVersion, created_at AS createdAt FROM analyses WHERE user_id = ?1 ORDER BY created_at", [user.id]),
    savedCosts: await allRows("SELECT id, profile_id AS profileId, sku, product_cost_paise AS productCostPaise, packaging_cost_paise AS packagingCostPaise, variable_cost_paise AS variableCostPaise, updated_at AS updatedAt FROM saved_costs WHERE user_id = ?1 ORDER BY updated_at", [user.id]),
    sellerProfiles: await allRows("SELECT id, name, created_at AS createdAt FROM seller_profiles WHERE user_id = ?1 ORDER BY created_at", [user.id]),
    alerts: await allRows("SELECT id, type, sku, message, status, created_at AS createdAt FROM alerts WHERE user_id = ?1 ORDER BY created_at", [user.id]),
    payments: await allRows("SELECT id, provider_order_id AS providerOrderId, provider_payment_id AS providerPaymentId, analysis_id AS analysisId, product, provider, amount_paise AS amountPaise, currency, status, provider_status AS providerStatus, created_at AS createdAt, updated_at AS updatedAt FROM payments WHERE user_id = ?1 ORDER BY created_at", [user.id]),
    subscriptions: await allRows("SELECT id, provider_subscription_id AS providerSubscriptionId, provider, plan, status, current_period_end AS currentPeriodEnd, cancel_at_period_end AS cancelAtPeriodEnd, ended_at AS endedAt, created_at AS createdAt, updated_at AS updatedAt FROM subscriptions WHERE user_id = ?1 ORDER BY created_at", [user.id]),
    tenantData: tenantExports,
    notes: [
      "Raw normal-analysis files are not included because SellerHisab does not store those raw files on the server.",
      "Connector secrets are intentionally excluded from export. Disconnecting or deleting an account removes stored connector credentials for deleted owner workspaces.",
      "Payment/audit records may be retained after deletion where required for fraud, accounting, tax, dispute or legal obligations.",
    ],
  });
}

export async function deleteAccountData(user: SessionUser): Promise<{ receiptId: string }> {
  const db = getD1();
  const owned = await db.prepare(`
    SELECT t.id,
           (SELECT COUNT(*) FROM tenant_members tm WHERE tm.tenant_id = t.id AND tm.user_id <> ?1) AS otherMembers
    FROM tenants t WHERE t.owner_user_id = ?1
  `).bind(user.id).all<{ id: string; otherMembers: number }>();
  const sharedOwned = (owned.results ?? []).filter((row) => Number(row.otherMembers) > 0);
  if (sharedOwned.length) throw new AccountDeletionBlockedError("Remove other workspace members before deleting an owner account, so shared business data is not destroyed unexpectedly.");

  const subscriptions = await db.prepare(`
    SELECT id, provider_subscription_id AS providerSubscriptionId, status
    FROM subscriptions
    WHERE user_id = ?1 AND provider = 'razorpay' AND status IN ('created','authenticated','active','pending','halted','paused')
  `).bind(user.id).all<{ id: string; providerSubscriptionId: string; status: string }>();

  // Stop future billing before personal access is removed. If the provider is
  // unavailable, deletion fails closed instead of leaving an invisible charge.
  for (const subscription of subscriptions.results ?? []) {
    try {
      await cancelRazorpaySubscription(subscription.providerSubscriptionId, false);
    } catch {
      throw new AccountDeletionBlockedError("Active subscription cancellation could not be confirmed. Try again later or contact support before deleting the account.");
    }
  }

  const now = new Date().toISOString();
  const userHash = await sha256(`sellerhisab-delete:${user.id}`);
  const pseudonymEmail = `deleted+${userHash.slice(0, 24)}@deleted.sellerhisab.invalid`;
  const receiptId = randomId("del");
  const ownedTenantIds = (owned.results ?? []).map((row) => row.id);

  const statements = [
    db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(user.id),
    db.prepare("DELETE FROM otp_challenges WHERE lower(email) = lower(COALESCE(?1, ''))").bind(user.email ?? ""),
    db.prepare("DELETE FROM alerts WHERE user_id = ?1").bind(user.id),
    db.prepare("DELETE FROM analyses WHERE user_id = ?1").bind(user.id),
    db.prepare("DELETE FROM saved_costs WHERE user_id = ?1").bind(user.id),
    db.prepare("DELETE FROM seller_profiles WHERE user_id = ?1").bind(user.id),
    db.prepare("DELETE FROM connector_oauth_states WHERE user_id = ?1").bind(user.id),
    db.prepare("DELETE FROM workspace_preferences WHERE user_id = ?1").bind(user.id),
    db.prepare("DELETE FROM tenant_members WHERE user_id = ?1").bind(user.id),
    db.prepare("UPDATE workspace_invites SET invited_by_user_id = NULL WHERE invited_by_user_id = ?1").bind(user.id),
    db.prepare("UPDATE action_workflows SET assigned_to_user_id = NULL WHERE assigned_to_user_id = ?1").bind(user.id),
    db.prepare("UPDATE action_workflows SET requested_by_user_id = NULL WHERE requested_by_user_id = ?1").bind(user.id),
    db.prepare("UPDATE action_workflows SET approved_by_user_id = NULL WHERE approved_by_user_id = ?1").bind(user.id),
    db.prepare("UPDATE action_workflows SET rejected_by_user_id = NULL WHERE rejected_by_user_id = ?1").bind(user.id),
    db.prepare("UPDATE action_workflows SET completed_by_user_id = NULL WHERE completed_by_user_id = ?1").bind(user.id),
    db.prepare("UPDATE audit_events SET user_id = NULL WHERE user_id = ?1").bind(user.id),
    db.prepare("UPDATE data_imports SET user_id = NULL WHERE user_id = ?1").bind(user.id),
    db.prepare("UPDATE payments SET user_id = NULL WHERE user_id = ?1").bind(user.id),
    db.prepare("UPDATE entitlements SET user_id = NULL, status = CASE WHEN status = 'active' THEN 'revoked' ELSE status END WHERE user_id = ?1").bind(user.id),
    db.prepare("UPDATE billing_audit_events SET user_id = NULL WHERE user_id = ?1").bind(user.id),
    db.prepare("UPDATE support_request_events SET actor_user_id = NULL WHERE actor_user_id = ?1").bind(user.id),
    db.prepare("UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 0, ended_at = ?2, updated_at = ?3 WHERE user_id = ?1 AND status NOT IN ('cancelled','completed','expired')").bind(user.id, Date.now(), now),
    db.prepare(`UPDATE users SET email = ?2, phone = NULL, password_hash = NULL, name = NULL, city = NULL, deleted_at = ?3 WHERE id = ?1 AND deleted_at IS NULL`).bind(user.id, pseudonymEmail, now),
    db.prepare(`INSERT INTO account_deletion_receipts (id, user_hash, requested_at, completed_at, retained_categories_json, deleted_categories_json) VALUES (?1, ?2, ?3, ?3, ?4, ?5)`).bind(
      receiptId,
      userHash,
      now,
      JSON.stringify(["pseudonymized user shell", "payments", "subscriptions", "billing audit", "statutory/dispute records"]),
      JSON.stringify(["sessions", "analyses", "saved costs", "seller profiles", "alerts", "workspace memberships", "owned workspace operational data", "connector credentials", "normalized bank/ads/inventory data"]),
    ),
  ];
  for (const tenantId of ownedTenantIds) statements.unshift(db.prepare("DELETE FROM tenants WHERE id = ?1 AND owner_user_id = ?2").bind(tenantId, user.id));
  await db.batch(statements);
  return { receiptId };
}

export class AccountDeletionBlockedError extends Error {}
