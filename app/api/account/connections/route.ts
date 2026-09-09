import { getSessionUser } from "@/server/auth";
import { PlanAccessError, requirePaidCapability } from "@/server/plan-access";
import { getD1 } from "@/server/runtime";
import { listAccountConnectorReadiness, type ConnectorReadiness } from "@/core/connectors/health";
import { connectorApiConfigured } from "@/server/connectors/providers";
import { findUserTenantId } from "@/server/connectors/store";
import type { ApiConnectorId } from "@/core/connectors/api-runtime";

export const dynamic = "force-dynamic";

type ConnectionRow = {
  id: string;
  connectorId: string;
  mode: string;
  status: string;
  enabledCapabilitiesJson: string;
  grantedScopesJson: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  externalAccountId: string | null;
  displayName: string | null;
  syncStatus: string | null;
  syncCoverageStart: string | null;
  syncCoverageEnd: string | null;
  syncOrderCount: number | null;
  syncFinancialRecordCount: number | null;
  syncIssueCount: number | null;
  syncCompletedAt: string | null;
  syncErrorCode: string | null;
  jobStatus: string | null;
  jobNextAttemptAt: string | null;
  jobAttemptCount: number | null;
  jobMaxAttempts: number | null;
};

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isApiConnectorId(value: string): value is ApiConnectorId {
  return value === "amazon-in-v1" || value === "flipkart-v1" || value === "shopify-v1" || value === "woocommerce-v1";
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try { await requirePaidCapability(user, "connectors"); } catch (error) { if (error instanceof PlanAccessError) return Response.json({ error: error.message, requiredPlan: error.requiredPlan }, { status: 402 }); throw error; }

  const tenantId = await findUserTenantId(user.id);

  const persisted = tenantId
    ? await getD1()
        .prepare(`
          SELECT
            cc.id,
            cc.connector_id AS connectorId,
            cc.mode,
            cc.status,
            cc.enabled_capabilities_json AS enabledCapabilitiesJson,
            cc.granted_scopes_json AS grantedScopesJson,
            cc.last_sync_at AS lastSyncAt,
            cc.last_success_at AS lastSuccessAt,
            cc.last_error_code AS lastErrorCode,
            cc.last_error_message AS lastErrorMessage,
            ca.external_account_id AS externalAccountId,
            ca.display_name AS displayName,
            csr.status AS syncStatus,
            csr.coverage_start AS syncCoverageStart,
            csr.coverage_end AS syncCoverageEnd,
            csr.order_count AS syncOrderCount,
            csr.financial_record_count AS syncFinancialRecordCount,
            csr.issue_count AS syncIssueCount,
            csr.completed_at AS syncCompletedAt,
            csr.error_code AS syncErrorCode,
            csj.status AS jobStatus,
            csj.next_attempt_at AS jobNextAttemptAt,
            csj.attempt_count AS jobAttemptCount,
            csj.max_attempts AS jobMaxAttempts
          FROM connector_connections cc
          LEFT JOIN channel_accounts ca ON ca.id = cc.channel_account_id
          LEFT JOIN connector_sync_runs csr ON csr.id = (
            SELECT csr2.id
            FROM connector_sync_runs csr2
            WHERE csr2.connection_id = cc.id
            ORDER BY csr2.started_at DESC
            LIMIT 1
          )
          LEFT JOIN connector_sync_jobs csj ON csj.id = (
            SELECT csj2.id
            FROM connector_sync_jobs csj2
            WHERE csj2.connection_id = cc.id
            ORDER BY csj2.created_at DESC
            LIMIT 1
          )
          WHERE cc.tenant_id = ?1
          ORDER BY cc.updated_at DESC
        `)
        .bind(tenantId)
        .all<ConnectionRow>()
    : { results: [] as ConnectionRow[] };

  const byConnector = new Map<string, ConnectionRow>();
  for (const row of persisted.results ?? []) {
    if (!byConnector.has(row.connectorId)) byConnector.set(row.connectorId, row);
  }

  const connections = listAccountConnectorReadiness().map((item) => {
    const row = byConnector.get(item.connectorId);
    const apiConfigured = isApiConnectorId(item.connectorId) ? connectorApiConfigured(item.connectorId) : false;
    if (!row) {
      return {
        ...item,
        apiConfigured,
        connectionMode: null,
        externalAccountDisplayName: null,
        grantedScopes: [] as string[],
        latestSync: null,
      };
    }

    const accountStatus: ConnectorReadiness["accountStatus"] =
      row.status === "connected" || row.status === "healthy"
        ? "connected"
        : row.status === "degraded" || row.status === "error"
          ? "degraded"
          : row.status === "disabled"
            ? "disabled"
            : "not-connected";

    return {
      ...item,
      accountStatus,
      apiConfigured,
      connectionMode: row.mode,
      externalAccountDisplayName: row.displayName ?? row.externalAccountId,
      enabledCapabilities: parseStringArray(row.enabledCapabilitiesJson),
      grantedScopes: parseStringArray(row.grantedScopesJson),
      lastSuccessAt: row.lastSuccessAt ?? undefined,
      lastError: row.lastErrorCode ? (row.lastErrorMessage?.slice(0, 220) || `Last sync needs attention (${row.lastErrorCode.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 48) || "connector_error"}).`) : undefined,
      latestSync: row.syncStatus ? {
        status: row.syncStatus,
        coverageStart: row.syncCoverageStart,
        coverageEnd: row.syncCoverageEnd,
        orderCount: row.syncOrderCount ?? 0,
        financialRecordCount: row.syncFinancialRecordCount ?? 0,
        issueCount: row.syncIssueCount ?? 0,
        completedAt: row.syncCompletedAt,
        errorCode: row.syncErrorCode,
      } : null,
      retryJob: row.jobStatus ? {
        status: row.jobStatus,
        nextAttemptAt: row.jobNextAttemptAt,
        attemptCount: row.jobAttemptCount ?? 0,
        maxAttempts: row.jobMaxAttempts ?? 5,
      } : null,
    };
  });

  return Response.json({
    connections,
    rawCredentialStorage: false,
    encryptedTokenStorage: true,
    message: "SellerHisab never stores marketplace passwords. Official API access/refresh tokens are encrypted at rest and can be disconnected by the seller.",
  });
}
