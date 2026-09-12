import type { ApiConnectorId } from "@/core/connectors/api-runtime";
import { randomId } from "../crypto";
import { getD1 } from "../runtime";
import { getOwnedApiConnection } from "./store";

export type ConnectedReportBreakdown = {
  semantic: string;
  currency: string;
  rowCount: number;
  amountPaise: number;
};

export type ConnectedReportSnapshot = {
  reportKey: "connected-summary";
  connectorId: ApiConnectorId;
  connectionId: string;
  dataRevision: number;
  generatedAt: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  ledgerRecordCount: number;
  orderLinkedRecordCount: number;
  breakdown: ConnectedReportBreakdown[];
  latestSync: {
    status: string | null;
    orderCount: number;
    financialRecordCount: number;
    issueCount: number;
    completedAt: string | null;
  };
  disclaimer: string;
};

type ConnectionReportRow = {
  id: string;
  tenantId: string;
  connectorId: ApiConnectorId;
  channelAccountId: string | null;
  dataRevision: number;
};

type AggregateRow = {
  semantic: string;
  currency: string;
  rowCount: number;
  amountPaise: number;
  coverageStart: string | null;
  coverageEnd: string | null;
};

/**
 * Builds an auditable saved view of normalized API data. It intentionally does
 * not call the observed ledger sum "profit": connected marketplace records can
 * contain order, fee, settlement and payout observations that must be combined
 * with seller costs before a true contribution/profit claim is made.
 */
export async function refreshConnectedReportSnapshot(connectionId: string): Promise<ConnectedReportSnapshot> {
  const db = getD1();
  const connection = await db.prepare(`
    SELECT id, tenant_id AS tenantId, connector_id AS connectorId,
           channel_account_id AS channelAccountId, data_revision AS dataRevision
    FROM connector_connections
    WHERE id = ?1 AND status <> 'disabled'
    LIMIT 1
  `).bind(connectionId).first<ConnectionReportRow>();
  if (!connection) throw new Error("Connected marketplace report is unavailable.");

  const aggregate = connection.channelAccountId
    ? await db.prepare(`
        SELECT semantic, currency, COUNT(*) AS rowCount, COALESCE(SUM(amount_paise), 0) AS amountPaise,
               MIN(occurred_at) AS coverageStart, MAX(occurred_at) AS coverageEnd
        FROM commerce_ledger_entries
        WHERE tenant_id = ?1 AND channel_account_id = ?2
        GROUP BY semantic, currency
        ORDER BY semantic, currency
        LIMIT 300
      `).bind(connection.tenantId, connection.channelAccountId).all<AggregateRow>()
    : { results: [] as AggregateRow[] };

  const counts = connection.channelAccountId
    ? await db.prepare(`
        SELECT COUNT(*) AS ledgerRecordCount,
               COUNT(DISTINCT CASE WHEN order_line_uid IS NOT NULL AND order_line_uid <> '' THEN order_line_uid END) AS orderLinkedRecordCount,
               MIN(occurred_at) AS coverageStart,
               MAX(occurred_at) AS coverageEnd
        FROM commerce_ledger_entries
        WHERE tenant_id = ?1 AND channel_account_id = ?2
      `).bind(connection.tenantId, connection.channelAccountId).first<{
        ledgerRecordCount: number;
        orderLinkedRecordCount: number;
        coverageStart: string | null;
        coverageEnd: string | null;
      }>()
    : null;

  const latestSync = await db.prepare(`
    SELECT status, order_count AS orderCount, financial_record_count AS financialRecordCount,
           issue_count AS issueCount, completed_at AS completedAt
    FROM connector_sync_runs
    WHERE connection_id = ?1
    ORDER BY started_at DESC
    LIMIT 1
  `).bind(connection.id).first<{
    status: string;
    orderCount: number;
    financialRecordCount: number;
    issueCount: number;
    completedAt: string | null;
  }>();

  const generatedAt = new Date().toISOString();
  const payload: ConnectedReportSnapshot = {
    reportKey: "connected-summary",
    connectorId: connection.connectorId,
    connectionId: connection.id,
    dataRevision: connection.dataRevision ?? 0,
    generatedAt,
    coverageStart: counts?.coverageStart ?? null,
    coverageEnd: counts?.coverageEnd ?? null,
    ledgerRecordCount: Number(counts?.ledgerRecordCount ?? 0),
    orderLinkedRecordCount: Number(counts?.orderLinkedRecordCount ?? 0),
    breakdown: (aggregate.results ?? []).map((row) => ({
      semantic: row.semantic,
      currency: row.currency,
      rowCount: Number(row.rowCount ?? 0),
      amountPaise: Number(row.amountPaise ?? 0),
    })),
    latestSync: {
      status: latestSync?.status ?? null,
      orderCount: Number(latestSync?.orderCount ?? 0),
      financialRecordCount: Number(latestSync?.financialRecordCount ?? 0),
      issueCount: Number(latestSync?.issueCount ?? 0),
      completedAt: latestSync?.completedAt ?? null,
    },
    disclaimer: "Connected-data totals are source observations, not standalone profit. Seller costs and validated settlement evidence are required for profit/contribution analysis.",
  };

  await db.batch([
    db.prepare(`
      INSERT INTO connector_report_snapshots
        (id, tenant_id, connection_id, report_key, data_revision, payload_json, generated_at, updated_at)
      VALUES (?1, ?2, ?3, 'connected-summary', ?4, ?5, ?6, ?6)
      ON CONFLICT(connection_id, report_key) DO UPDATE SET
        data_revision = excluded.data_revision,
        payload_json = excluded.payload_json,
        generated_at = excluded.generated_at,
        updated_at = excluded.updated_at
      WHERE connector_report_snapshots.tenant_id = excluded.tenant_id
    `).bind(randomId("crs"), connection.tenantId, connection.id, payload.dataRevision, JSON.stringify(payload), generatedAt),
    db.prepare(`
      UPDATE connector_connections
      SET report_revision = data_revision, last_report_refresh_at = ?2, updated_at = ?2
      WHERE id = ?1 AND tenant_id = ?3 AND status <> 'disabled'
    `).bind(connection.id, generatedAt, connection.tenantId),
  ]);

  return payload;
}

export async function getConnectedReportForUser(userId: string, connectorId: ApiConnectorId): Promise<ConnectedReportSnapshot | null> {
  const connection = await getOwnedApiConnection(userId, connectorId);
  if (!connection || connection.status === "disabled") return null;
  const db = getD1();
  const state = await db.prepare(`
    SELECT data_revision AS dataRevision, report_revision AS reportRevision
    FROM connector_connections WHERE id = ?1 LIMIT 1
  `).bind(connection.id).first<{ dataRevision: number; reportRevision: number }>();

  if (!state || state.reportRevision !== state.dataRevision) return refreshConnectedReportSnapshot(connection.id);

  const row = await db.prepare(`
    SELECT payload_json AS payloadJson
    FROM connector_report_snapshots
    WHERE connection_id = ?1 AND report_key = 'connected-summary'
    LIMIT 1
  `).bind(connection.id).first<{ payloadJson: string }>();
  if (!row) return refreshConnectedReportSnapshot(connection.id);
  try {
    return JSON.parse(row.payloadJson) as ConnectedReportSnapshot;
  } catch {
    return refreshConnectedReportSnapshot(connection.id);
  }
}
