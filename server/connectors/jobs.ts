import {hasPaidCapability} from "../plan-access";
import { initialCheckpoint, coverageFor, type PageCheckpoint } from "@/core/connectors/coverage";
import { sha256 } from "../crypto";
import { ProviderTransportError } from "../provider-http";
import { randomId } from "../crypto";
import { getD1, runtimeEnv } from "../runtime";
import { getConnectionById } from "./store";
import { runConnectorSync, type ConnectorSyncSummary } from "./sync";

const JOB_STALE_MS = 10 * 60_000;
const MAX_DUE_PER_TICK = 100;

function safeFailure(error: unknown): { code: string; message: string } {
  const value = error as { code?: unknown; message?: unknown };
  const code = String(value?.code ?? "sync_failed").replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 48) || "sync_failed";
  const message = "Marketplace sync could not finish. Check connection permissions or retry after the provider recovers.";
  return { code, message };
}

function retryDelayMs(attempt: number): number {
  return Math.min(6 * 60 * 60_000, 15 * 60_000 * Math.max(1, 2 ** Math.max(0, attempt - 1)));
}

export async function enqueueConnectorSyncJob(input: { tenantId: string; connectionId: string; requestedByUserId: string; days: number; orderDateField?:'updated_at' }): Promise<string> {
  const now = new Date().toISOString();
  if(!Number.isInteger(input.days)||input.days<1||input.days>3650)throw Error('invalid_history_range');
  const owned=await getD1().prepare("SELECT 1 FROM connector_connections cc JOIN tenants t ON t.id=cc.tenant_id JOIN users u ON u.id=?3 WHERE cc.id=?1 AND cc.tenant_id=?2 AND cc.status<>'disabled' AND u.deleted_at IS NULL AND (t.owner_user_id=u.id OR EXISTS(SELECT 1 FROM tenant_members tm WHERE tm.tenant_id=t.id AND tm.user_id=u.id AND tm.role IN ('owner','admin','analyst')))").bind(input.connectionId,input.tenantId,input.requestedByUserId).first();
  if(!owned)throw Error('connection_scope_unavailable');
  const checkpoint = initialCheckpoint(input.days);
  if(input.orderDateField)checkpoint.orderDateField=input.orderDateField;
  const existing = await getD1().prepare(`
    SELECT id FROM connector_sync_jobs
    WHERE connection_id = ?1 AND status IN ('queued','processing','retryable_failed')
    ORDER BY created_at DESC LIMIT 1
  `).bind(input.connectionId).first<{ id: string }>();
  if (existing?.id) return existing.id;
  const id = randomId("csj");
  const logicalKey = `active:${input.connectionId}`;
  await getD1().prepare(`
    INSERT OR IGNORE INTO connector_sync_jobs
      (id, tenant_id, connection_id, requested_by_user_id, days, status, attempt_count, max_attempts, next_attempt_at, created_at, updated_at, logical_key, checkpoint_json, coverage_json)
    VALUES (?1, ?2, ?3, ?4, ?5, 'queued', 0, 5, ?6, ?6, ?6, ?7, ?8, ?9)
  `).bind(id, input.tenantId, input.connectionId, input.requestedByUserId, input.days, now, logicalKey, JSON.stringify(checkpoint), JSON.stringify(coverageFor(checkpoint))).run();
  const saved = await getD1().prepare("SELECT id FROM connector_sync_jobs WHERE logical_key=?1 AND tenant_id=?2").bind(logicalKey,input.tenantId).first<{id:string}>();
  if (!saved) throw new Error("Sync could not be queued.");
  return saved.id;
}

export async function processConnectorSyncJob(jobId: string): Promise<ConnectorSyncSummary | null> {
  const db = getD1();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - JOB_STALE_MS).toISOString();
  const lease = crypto.randomUUID();
  const claimed = await db.prepare(`
    UPDATE connector_sync_jobs
    SET status = 'processing', lease_token=?4, processing_started_at = ?2, attempt_count = attempt_count + 1, updated_at = ?2
    WHERE id = ?1
      AND attempt_count < max_attempts
      AND (status IN ('queued','retryable_failed') OR (status = 'processing' AND processing_started_at < ?3))
      AND next_attempt_at <= ?2
  `).bind(jobId, now, staleBefore, lease).run();
  if ((claimed.meta.changes ?? 0) !== 1) return null;

  const job = await db.prepare(`
    SELECT id, tenant_id AS tenantId, connection_id AS connectionId, requested_by_user_id AS requestedByUserId,
           days, checkpoint_json AS checkpointJson, attempt_count AS attemptCount, max_attempts AS maxAttempts
    FROM connector_sync_jobs WHERE id = ?1 LIMIT 1
  `).bind(jobId).first<{ id: string; tenantId: string; connectionId: string; requestedByUserId: string | null; days: number; checkpointJson: string | null; attemptCount: number; maxAttempts: number }>();
  if (!job) return null;
  const connection = await getConnectionById(job.connectionId);
  if (!connection || connection.tenantId !== job.tenantId || connection.status === "disabled") {
    await db.prepare(`UPDATE connector_sync_jobs SET status = 'terminal_failed', logical_key = NULL, last_error_code = 'connection_unavailable', last_error_message = 'Connection was removed or disabled.', processing_started_at = NULL, completed_at = ?2, updated_at = ?2 WHERE id = ?1 AND lease_token = ?3`).bind(jobId, new Date().toISOString(),lease).run();
    return null;
  }
  const actorUserId = job.requestedByUserId ?? await tenantOwnerUserId(job.tenantId);
  if (!actorUserId) {
    await db.prepare(`UPDATE connector_sync_jobs SET status = 'terminal_failed', logical_key = NULL, last_error_code = 'actor_unavailable', last_error_message = 'No workspace owner is available for retry audit.', processing_started_at = NULL, completed_at = ?2, updated_at = ?2 WHERE id = ?1 AND lease_token = ?3`).bind(jobId, new Date().toISOString(),lease).run();
    return null;
  }

  try {
    if(!await hasPaidCapability(actorUserId,'connectors'))throw Object.assign(Error('Active connector plan required.'),{code:'plan_unavailable'});
    const checkpoint: PageCheckpoint = job.checkpointJson ? JSON.parse(job.checkpointJson) : initialCheckpoint(job.days);
    const summary = await runConnectorSync({ userId: actorUserId, connection, days: job.days, jobId, checkpoint, lease });
    const completedAt = new Date().toISOString();
    const nextAttemptAt=summary.checkpoint.notBefore??completedAt;
    const pageKey = await sha256([checkpoint.sliceStart,checkpoint.stage,checkpoint.cursor].join(':'));
    await db.batch([
      db.prepare("UPDATE connector_connections SET status=?2,last_sync_at=?3,last_success_at=?3,last_error_code=?4,last_error_message=?5,updated_at=?3 WHERE id=?1 AND EXISTS(SELECT 1 FROM connector_sync_jobs WHERE id=?6 AND lease_token=?7) AND ?8=1 AND status<>'disabled'").bind(connection.id,summary.coverage.state==='complete'?'healthy':'degraded',completedAt,summary.coverage.state==='partial'?'partial_coverage':null,summary.warning??null,jobId,lease,summary.checkpoint.done?1:0),
      db.prepare("INSERT OR IGNORE INTO connector_page_receipts(id,job_id,page_key,created_at) SELECT ?1||':'||?2,?1,?2,?3 FROM connector_sync_jobs WHERE id=?1 AND lease_token=?4").bind(jobId,pageKey,completedAt,lease),
      db.prepare("UPDATE connector_sync_jobs SET status=?3,logical_key=CASE WHEN ?4 THEN NULL ELSE logical_key END,checkpoint_json=?5,coverage_json=?6,attempt_count=0,processing_started_at=NULL,lease_token=NULL,last_error_code=NULL,last_error_message=NULL,completed_at=CASE WHEN ?4 THEN ?2 ELSE NULL END,next_attempt_at=?8,updated_at=?2 WHERE id=?1 AND lease_token=?7")
        .bind(jobId,completedAt,summary.checkpoint.done?(summary.coverage.state==='complete'?'completed':'partial'):'queued',summary.checkpoint.done?1:0,JSON.stringify(summary.checkpoint),JSON.stringify(summary.coverage),lease,nextAttemptAt),
    ]);
    if (!summary.checkpoint.done) await runtimeEnv().CONNECTOR_QUEUE?.send({kind:'connector',id:jobId},{delaySeconds:Math.min(43200,Math.max(0,Math.ceil((Date.parse(nextAttemptAt)-Date.now())/1000)))}).catch(()=>console.error(JSON.stringify({event:'connector.enqueue.failed',recovery:'scheduled_outbox'})));
    return summary;
  } catch (error) {
    const failure = safeFailure(error);
    const exhausted = job.attemptCount >= job.maxAttempts;
    const nextAttemptAt = new Date(Date.now() + Math.max(retryDelayMs(job.attemptCount), error instanceof ProviderTransportError ? error.retryAfterMs : 0)).toISOString();
    await db.prepare(`
      UPDATE connector_sync_jobs
      SET status = ?2, logical_key = CASE WHEN ?2 = 'dead_letter' THEN NULL ELSE logical_key END, processing_started_at = NULL, last_error_code = ?3, last_error_message = ?4,
          next_attempt_at = ?5, completed_at = CASE WHEN ?2 = 'dead_letter' THEN ?6 ELSE NULL END, updated_at = ?6
      WHERE id = ?1 AND lease_token = ?7
    `).bind(jobId, exhausted ? "dead_letter" : "retryable_failed", failure.code, failure.message, nextAttemptAt, new Date().toISOString(), lease).run();
    throw error;
  }
}

export async function processDueConnectorSyncJobs(): Promise<{ attempted: number; completed: number }> {
  const now = new Date().toISOString();
  await getD1().prepare("UPDATE connector_sync_jobs SET status='dead_letter',logical_key=NULL,last_error_code='lease_exhausted' WHERE status='processing' AND attempt_count>=max_attempts AND processing_started_at<?1").bind(new Date(Date.now()-JOB_STALE_MS).toISOString()).run();
  const due = await getD1().prepare(`
    SELECT id FROM connector_sync_jobs
    WHERE (status IN ('queued','retryable_failed') OR (status='processing' AND processing_started_at < ?3)) AND next_attempt_at <= ?1 AND attempt_count < max_attempts
    ORDER BY next_attempt_at ASC LIMIT ?2
  `).bind(now, MAX_DUE_PER_TICK, new Date(Date.now()-JOB_STALE_MS).toISOString()).all<{ id: string }>();
  let completed = 0;
  for (const row of due.results ?? []) {
    if (runtimeEnv().CONNECTOR_QUEUE) { await runtimeEnv().CONNECTOR_QUEUE!.send({kind:"connector",id:row.id}); completed += 1; }
  }
  return { attempted: (due.results ?? []).length, completed };
}

async function tenantOwnerUserId(tenantId: string): Promise<string | null> {
  const row = await getD1().prepare("SELECT owner_user_id AS ownerUserId FROM tenants WHERE id = ?1 LIMIT 1").bind(tenantId).first<{ ownerUserId: string }>();
  return row?.ownerUserId ?? null;
}

export async function connectorJobOperationalReport() {
  const rows = await getD1().prepare(`
    SELECT csj.id, csj.tenant_id AS tenantId, csj.connection_id AS connectionId, cc.connector_id AS connectorId,
           csj.status, csj.attempt_count AS attemptCount, csj.max_attempts AS maxAttempts,
           csj.next_attempt_at AS nextAttemptAt, csj.last_error_code AS lastErrorCode,
           csj.last_error_message AS lastErrorMessage, csj.updated_at AS updatedAt
    FROM connector_sync_jobs csj
    JOIN connector_connections cc ON cc.id = csj.connection_id AND cc.tenant_id = csj.tenant_id
    WHERE csj.status IN ('queued','processing','retryable_failed','dead_letter','terminal_failed')
    ORDER BY CASE csj.status WHEN 'dead_letter' THEN 0 WHEN 'terminal_failed' THEN 1 WHEN 'retryable_failed' THEN 2 WHEN 'processing' THEN 3 ELSE 4 END,
             csj.updated_at DESC
    LIMIT 300
  `).all();
  return rows.results ?? [];
}
