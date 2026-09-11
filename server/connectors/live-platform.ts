import type { ApiConnectorId } from "@/core/connectors/api-runtime";
import { ACTIVE_MARKETPLACE_API_PLATFORM_IDS, clampMarketplaceSyncInterval, marketplaceApiPlatformForConnector } from "@/core/connectors/platform";
import { hasPaidCapability } from "../plan-access";
import { getD1 } from "../runtime";
import { enqueueConnectorSyncJob } from "./jobs";
import { getOwnedApiConnection } from "./store";

const AUTO_SYNC_BATCH_LIMIT = 30;
const NON_PRO_RECHECK_MINUTES = 24 * 60;

export type ConnectionLiveSyncState = {
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  nextAutoSyncAt: string | null;
};

function isApiConnectorId(value: string): value is ApiConnectorId {
  return (ACTIVE_MARKETPLACE_API_PLATFORM_IDS as readonly string[]).includes(value);
}

function nextIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function updateConnectionLiveSync(input: {
  userId: string;
  connectorId: ApiConnectorId;
  enabled: boolean;
  intervalMinutes?: number;
}): Promise<ConnectionLiveSyncState> {
  const connection = await getOwnedApiConnection(input.userId, input.connectorId);
  if (!connection || connection.status === "disabled") throw new Error("Connect this marketplace before enabling live sync.");
  const platform = marketplaceApiPlatformForConnector(input.connectorId);
  if (!platform.incrementalSync || !platform.pollingBackstop) throw new Error("Automatic sync is not supported for this marketplace yet.");

  const intervalMinutes = clampMarketplaceSyncInterval(
    input.connectorId,
    input.intervalMinutes ?? platform.defaultSyncIntervalMinutes,
  );
  const nextAutoSyncAt = input.enabled ? new Date().toISOString() : null;
  await getD1().prepare(`
    UPDATE connector_connections
    SET auto_sync_enabled = ?2,
        sync_interval_minutes = ?3,
        next_auto_sync_at = ?4,
        updated_at = ?5
    WHERE id = ?1 AND tenant_id = ?6 AND status <> 'disabled'
  `).bind(
    connection.id,
    input.enabled ? 1 : 0,
    intervalMinutes,
    nextAutoSyncAt,
    new Date().toISOString(),
    connection.tenantId,
  ).run();
  return { autoSyncEnabled: input.enabled, syncIntervalMinutes: intervalMinutes, nextAutoSyncAt };
}

/**
 * Runs from the shared five-minute Worker cron. The scheduler claims each due
 * connection by moving next_auto_sync_at forward before enqueueing, so repeated
 * cron executions cannot fan out duplicate jobs. Provider notifications remain
 * the fast path where supported; this is the freshness backstop.
 */
export async function scheduleDueMarketplaceAutoSyncs(limit = AUTO_SYNC_BATCH_LIMIT): Promise<{ due: number; queued: number; skippedForPlan: number; failed: number }> {
  const db = getD1();
  const now = new Date().toISOString();
  const rows = await db.prepare(`
    SELECT cc.id,
           cc.tenant_id AS tenantId,
           cc.connector_id AS connectorId,
           cc.sync_interval_minutes AS syncIntervalMinutes,
           t.owner_user_id AS ownerUserId
    FROM connector_connections cc
    JOIN tenants t ON t.id = cc.tenant_id
    JOIN users u ON u.id = t.owner_user_id
    WHERE cc.auto_sync_enabled = 1
      AND cc.status IN ('connected','healthy','degraded')
      AND (cc.next_auto_sync_at IS NULL OR cc.next_auto_sync_at <= ?1)
      AND u.deleted_at IS NULL
    ORDER BY COALESCE(cc.next_auto_sync_at, cc.last_success_at, cc.created_at), cc.id
    LIMIT ?2
  `).bind(now, Math.max(1, Math.min(100, Math.round(limit)))).all<{
    id: string;
    tenantId: string;
    connectorId: string;
    syncIntervalMinutes: number;
    ownerUserId: string;
  }>();

  let queued = 0;
  let skippedForPlan = 0;
  let failed = 0;
  for (const row of rows.results ?? []) {
    if (!isApiConnectorId(row.connectorId)) continue;
    const interval = clampMarketplaceSyncInterval(row.connectorId, Number(row.syncIntervalMinutes ?? 30));
    const paid = await hasPaidCapability(row.ownerUserId, "connectors");
    const claimedNext = paid ? nextIso(interval) : nextIso(NON_PRO_RECHECK_MINUTES);
    const claimed = await db.prepare(`
      UPDATE connector_connections
      SET next_auto_sync_at = ?2, sync_interval_minutes = ?3, updated_at = ?4
      WHERE id = ?1
        AND auto_sync_enabled = 1
        AND status IN ('connected','healthy','degraded')
        AND (next_auto_sync_at IS NULL OR next_auto_sync_at <= ?4)
    `).bind(row.id, claimedNext, interval, now).run();
    if ((claimed.meta.changes ?? 0) !== 1) continue;

    if (!paid) {
      skippedForPlan += 1;
      continue;
    }

    try {
      await enqueueConnectorSyncJob({
        tenantId: row.tenantId,
        connectionId: row.id,
        requestedByUserId: row.ownerUserId,
        days: 2,
        orderDateField: row.connectorId === "shopify-v1" ? "updated_at" : undefined,
        triggerKind: "auto",
      });
      queued += 1;
    } catch (error) {
      failed += 1;
      await db.prepare(`
        UPDATE connector_connections
        SET next_auto_sync_at = ?2,
            last_error_code = 'auto_sync_enqueue_failed',
            last_error_message = 'Automatic sync could not be queued. SellerHisab will retry shortly.',
            updated_at = ?3
        WHERE id = ?1 AND status <> 'disabled'
      `).bind(row.id, nextIso(5), new Date().toISOString()).run();
      console.error(JSON.stringify({
        event: "connector.auto_sync.enqueue_failed",
        connectorId: row.connectorId,
        connectionId: row.id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      }));
    }
  }

  return { due: (rows.results ?? []).length, queued, skippedForPlan, failed };
}
