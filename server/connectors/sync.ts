import { orderEventsToLedgerRecords, type ApiConnectorId, type ApiLedgerRecord } from '@/core/connectors/api-runtime';
import {PARSER_VERSION,type NormalizedEvent,type ParserIssue} from '@/core/types';
import type {SettlementEvidence} from '@/core/settlements/evidence';
import type {SettlementBatchEvidence} from '@/core/settlements/reconciliation';
import {coverageFor,type PageCheckpoint,type SourceCoverage} from '@/core/connectors/coverage';
import {randomId,sha256} from '../crypto';
import {getD1} from '../runtime';
import {ensureFreshCredential} from './providers';
import {loadCredential,storeCredential,type OwnedConnection} from './store';
import {fetchConnectorPage} from './pages';
export type ConnectorSyncSummary = {
  connectorId: ApiConnectorId;
  coverageStart: string;
  coverageEnd: string;
  orderCount: number;
  financialRecordCount: number;
  issueCount: number;
  ledgerRecordCount: number;
  warning?: string;
  checkpoint: PageCheckpoint;
  coverage: SourceCoverage;
};

export type SyncData = {
  events: NormalizedEvent[];
  evidence: SettlementEvidence[];
  batches: SettlementBatchEvidence[];
  issues: ParserIssue[];
  warning?: string;
};

function evidenceToLedgerRecords(evidence: SettlementEvidence[], batches: SettlementBatchEvidence[]): ApiLedgerRecord[] {
  const records: ApiLedgerRecord[] = evidence.map((item) => ({
    key: `${item.id}:money`,
    orderLineUid: item.orderItemId ?? item.orderId,
    semantic: `api-observation:${item.semantic || "marketplace-financial-event"}`,
    amountPaise: item.amountPaise,
    currency: item.currency || "INR",
    occurredAt: item.occurredAt,
    sourceReference: {
      channelId: item.channelId,
      channelAccountId: item.channelAccountId,
      orderId: item.orderId,
      orderItemId: item.orderItemId,
      batchId: item.batchId,
      cashStage: item.cashStage,
      finality: item.finality,
      source: item.source,
    },
  }));
  for (const batch of batches) {
    if (batch.expectedAmountPaise === undefined) continue;
    records.push({
      key: `${batch.id}:payout`,
      semantic: "api-observation:payout-expected",
      amountPaise: batch.expectedAmountPaise,
      currency: batch.currency || "INR",
      occurredAt: batch.issuedAt,
      sourceReference: {
        channelId: batch.channelId,
        channelAccountId: batch.channelAccountId,
        externalBatchId: batch.externalBatchId,
        status: batch.status,
        referenceKeys: batch.referenceKeys,
        observationOnly: true,
        source: batch.source,
      },
    });
  }
  return records;
}

function sanitizeFailure(error: unknown): { code: string; message: string } {
  const source = error as { code?: unknown; message?: unknown; status?: unknown };
  const code = String(source?.code ?? source?.status ?? "sync_failed").replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 48) || "sync_failed";
  const message = String(source?.message ?? "").replace(/[\r\n\t]+/g, " ").slice(0, 260) || "Marketplace sync failed.";
  return { code, message };
}

async function persistLedger(input: {
  userId: string;
  connection: OwnedConnection;
  coverageStart: string;
  coverageEnd: string;
  data: SyncData;
  syncRunId: string;
  jobId:string;lease:string;
}): Promise<number> {
  const db = getD1();
  const sourceFingerprint = `api-sync:${input.connection.connectorId}:${input.syncRunId}`;
  const importId = `imp_${(await sha256(sourceFingerprint)).slice(0, 28)}`;
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT OR IGNORE INTO data_imports
      (id, tenant_id, channel_account_id, user_id, source_kind, connector_id, parser_version, source_fingerprint, coverage_start, coverage_end, status, issue_count, created_at)
    SELECT ?1, ?2, ?3, ?4, 'api-sync', ?5, ?6, ?7, ?8, ?9, 'in_progress', ?10, ?11 FROM connector_sync_jobs WHERE id=?12 AND lease_token=?13
  `).bind(
    importId,
    input.connection.tenantId,
    input.connection.channelAccountId,
    input.userId,
    input.connection.connectorId,
    PARSER_VERSION,
    sourceFingerprint,
    input.coverageStart,
    input.coverageEnd,
    input.data.issues.length,
    now,input.jobId,input.lease,
  ).run();

  try {
    const records = [
      ...orderEventsToLedgerRecords(input.data.events),
      ...evidenceToLedgerRecords(input.data.evidence, input.data.batches),
    ];
    for (const record of records) {
      const id = `led_${(await sha256(`${input.connection.id}:${record.key}`)).slice(0, 30)}`;
      const existing = await db.prepare(`
        SELECT source_import_id, semantic, amount_paise, currency, occurred_at, source_reference_json
        FROM commerce_ledger_entries
        WHERE id = ?1 AND tenant_id = ?2
        LIMIT 1
      `).bind(id, input.connection.tenantId).first<{
        source_import_id: string | null;
        semantic: string;
        amount_paise: number;
        currency: string;
        occurred_at: string | null;
        source_reference_json: string | null;
      }>();
      const sourceJson = JSON.stringify({...record.sourceReference,coverageJobId:input.syncRunId.split(":")[0]});
      if (existing && (
        existing.semantic !== record.semantic
        || existing.amount_paise !== record.amountPaise
        || existing.currency !== record.currency
        || (existing.occurred_at ?? null) !== (record.occurredAt ?? null)
        || (existing.source_reference_json ?? null) !== sourceJson
      )) {
        await db.prepare(`
          INSERT INTO ledger_entry_revisions
            (id, ledger_entry_id, tenant_id, source_import_id, semantic, amount_paise, currency, occurred_at, source_reference_json, replaced_at)
          SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10 FROM connector_sync_jobs WHERE id=?11 AND lease_token=?12
        `).bind(
          randomId("lrev"),
          id,
          input.connection.tenantId,
          existing.source_import_id,
          existing.semantic,
          existing.amount_paise,
          existing.currency,
          existing.occurred_at,
          existing.source_reference_json,
          now,input.jobId,input.lease,
        ).run();
      }
      await db.prepare(`
        INSERT INTO commerce_ledger_entries
          (id, tenant_id, channel_account_id, source_import_id, order_line_uid, semantic, amount_paise, currency, occurred_at, source_reference_json, formula_version, created_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'api-sync-v2', ?11 FROM connector_sync_jobs WHERE id=?12 AND lease_token=?13
        ON CONFLICT(id) DO UPDATE SET
          channel_account_id = excluded.channel_account_id,
          source_import_id = excluded.source_import_id,
          order_line_uid = excluded.order_line_uid,
          semantic = excluded.semantic,
          amount_paise = excluded.amount_paise,
          currency = excluded.currency,
          occurred_at = excluded.occurred_at,
          source_reference_json = excluded.source_reference_json,
          formula_version = excluded.formula_version
        WHERE commerce_ledger_entries.tenant_id = excluded.tenant_id
      `).bind(
        id,
        input.connection.tenantId,
        input.connection.channelAccountId,
        importId,
        record.orderLineUid ?? null,
        record.semantic,
        record.amountPaise,
        record.currency,
        record.occurredAt ?? null,
        sourceJson,
        now,input.jobId,input.lease,
      ).run();
    }
    await db.prepare(`
      UPDATE data_imports
      SET status = 'completed', completed_at = ?2, failed_at = NULL, last_error_code = NULL
      WHERE id = ?1 AND tenant_id = ?3 AND EXISTS(SELECT 1 FROM connector_sync_jobs WHERE id=?4 AND lease_token=?5)
    `).bind(importId, new Date().toISOString(), input.connection.tenantId,input.jobId,input.lease).run();
    return records.length;
  } catch (error) {
    const failure = sanitizeFailure(error);
    await db.prepare(`
      UPDATE data_imports
      SET status = 'failed', failed_at = ?2, last_error_code = ?3
      WHERE id = ?1 AND tenant_id = ?4 AND EXISTS(SELECT 1 FROM connector_sync_jobs WHERE id=?5 AND lease_token=?6)
    `).bind(importId, new Date().toISOString(), failure.code, input.connection.tenantId,input.jobId,input.lease).run();
    throw error;
  }
}

export async function runConnectorSync(input:{userId:string;connection:OwnedConnection;days:number;jobId:string;checkpoint:PageCheckpoint;lease:string}):Promise<ConnectorSyncSummary>{
 const c=structuredClone(input.checkpoint),db=getD1();
 delete c.notBefore;
 const pageKey=await sha256([c.sliceStart,c.stage,c.cursor].join(':'));
 const seen=await db.prepare('SELECT 1 FROM connector_page_receipts WHERE job_id=?1 AND page_key=?2').bind(input.jobId,pageKey).first();
 if(seen)throw Error('pagination_cycle_detected');
 const stored=await loadCredential(input.connection.id),credential=await ensureFreshCredential(stored);
 if(credential.accessToken!==stored.accessToken||credential.refreshToken!==stored.refreshToken)await storeCredential(input.connection.id,credential);
 let page;
 try{page=await fetchConnectorPage(credential,input.connection,c);}catch(error){
  if((error as {status?:number}).status!==401||credential.provider==='woocommerce')throw error;
  const refreshed=await ensureFreshCredential({...credential,accessExpiresAt:0});
  await storeCredential(input.connection.id,refreshed);
  page=await fetchConnectorPage(refreshed,input.connection,c);
 }
 const ledgerRecordCount=await persistLedger({userId:input.userId,connection:input.connection,coverageStart:c.sliceStart,coverageEnd:c.sliceEnd,data:page.data,syncRunId:input.jobId+':'+pageKey,jobId:input.jobId,lease:input.lease});
 c.rowCounts.orders+=page.data.events.length;c.rowCounts.finance+=page.data.evidence.length;c.rowCounts.payouts+=page.data.batches.length;c.page++;
 c.warnings=[...new Set(c.warnings)];c.cursor=page.next;
 if(!page.next){c.stage++;if(c.stage>=page.stages){c.stage=0;if(c.sliceEnd===c.end)c.done=true;else{c.sliceStart=c.sliceEnd;c.sliceEnd=new Date(Math.min(Date.parse(c.end),Date.parse(c.sliceStart)+30*86400000)).toISOString();}}}
 const coverage=coverageFor(c);

 return {connectorId:input.connection.connectorId,coverageStart:c.start,coverageEnd:c.end,orderCount:c.rowCounts.orders,financialRecordCount:c.rowCounts.finance+c.rowCounts.payouts,issueCount:page.data.issues.length,ledgerRecordCount,warning:coverage.warnings.join(' ')||undefined,checkpoint:c,coverage};
}
