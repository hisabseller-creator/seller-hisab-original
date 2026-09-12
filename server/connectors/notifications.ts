import {hasPaidCapability} from '../plan-access';
import {getD1} from '../runtime';
import {enqueueConnectorSyncJob} from './jobs';

export async function dispatchConnectorNotifications(){
 const db=getD1(),now=new Date().toISOString();
 // Daily lookback is the freshness backstop when provider delivery is lost.
 // Oldest job creation is also a pacing clock for failed connections. Connection
 // itself remains free; only API sync is plan-gated.
 const stale=await db.prepare("SELECT cc.id,cc.connector_id AS connectorId,cc.tenant_id AS tenantId,t.owner_user_id AS userId FROM connector_connections cc JOIN tenants t ON t.id=cc.tenant_id JOIN users u ON u.id=t.owner_user_id WHERE cc.status IN ('connected','healthy','degraded') AND u.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM connector_sync_jobs j WHERE j.connection_id=cc.id AND (j.created_at>?1 OR j.status IN ('queued','processing','retryable_failed'))) ORDER BY COALESCE(cc.last_sync_at,cc.created_at),cc.id LIMIT 20").bind(new Date(Date.now()-86400000).toISOString()).all<{id:string;connectorId:string;tenantId:string;userId:string}>();
 for(const row of stale.results??[]){
  if(!await hasPaidCapability(row.userId,'connectors'))continue;
  await enqueueConnectorSyncJob({connectionId:row.id,tenantId:row.tenantId,requestedByUserId:row.userId,days:7,orderDateField:row.connectorId==='shopify-v1'?'updated_at':undefined,triggerKind:'recovery'});
 }
 await db.prepare("UPDATE connector_notifications SET state='complete',updated_at=?1 WHERE state='running' AND job_id IN (SELECT id FROM connector_sync_jobs WHERE status IN ('completed','partial'))").bind(now).run();
 await db.prepare("UPDATE connector_notifications SET state='failed',updated_at=?1 WHERE state='running' AND job_id IN (SELECT id FROM connector_sync_jobs WHERE status IN ('dead_letter','terminal_failed'))").bind(now).run();
 const rows=await db.prepare("SELECT n.id,n.connection_id AS connectionId,n.received_at AS receivedAt,n.history_days AS days,cc.tenant_id AS tenantId,t.owner_user_id AS userId FROM connector_notifications n JOIN connector_connections cc ON cc.id=n.connection_id JOIN tenants t ON t.id=cc.tenant_id WHERE n.state='queued' AND n.received_at<?1 AND cc.status<>'disabled' ORDER BY n.received_at LIMIT 20").bind(new Date(Date.now()-300000).toISOString()).all<{id:string;connectionId:string;receivedAt:string;days:number;tenantId:string;userId:string}>();
 for(const row of rows.results??[]){
  if(!await hasPaidCapability(row.userId,'connectors'))continue;
  const job=await enqueueConnectorSyncJob({tenantId:row.tenantId,connectionId:row.connectionId,requestedByUserId:row.userId,days:row.days,orderDateField:'updated_at',triggerKind:'notification'});
  // An older active job cannot satisfy a newer notification or wider range.
  await db.prepare("UPDATE connector_notifications SET state='running',job_id=?2,updated_at=?3 WHERE id=?1 AND state='queued' AND EXISTS(SELECT 1 FROM connector_sync_jobs WHERE id=?2 AND created_at>?4 AND days>=?5 AND json_extract(checkpoint_json,'$.orderDateField')='updated_at')").bind(row.id,job,now,new Date(Date.parse(row.receivedAt)+180000).toISOString(),row.days).run();
 }
 await db.prepare("DELETE FROM connector_notifications WHERE state='complete' AND updated_at<?1").bind(new Date(Date.now()-30*86400000).toISOString()).run();
}