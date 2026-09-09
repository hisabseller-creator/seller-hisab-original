import {getD1} from './runtime';
export type ReplayInput={kind:'billing'|'connector';id:string;expectedUpdatedAt:string;reason:string};
/** One failed durable record only; captured/provider verification remains authoritative. */
export async function replayFailedJob(input:ReplayInput,adminId:string){
 const db=getD1(),now=new Date().toISOString();
 const table=input.kind==='billing'?'billing_event_jobs':'connector_sync_jobs',key=input.kind==='billing'?'event_id':'id';
 const state=input.kind==='billing'?"state='dead_letter' AND payload_json<>'{}'":"status IN ('dead_letter','terminal_failed') AND NOT EXISTS(SELECT 1 FROM connector_sync_jobs active WHERE active.logical_key='active:'||connector_sync_jobs.connection_id) AND EXISTS(SELECT 1 FROM connector_connections cc WHERE cc.id=connector_sync_jobs.connection_id AND cc.status<>'disabled')";
 const predicate=key+'=?1 AND updated_at=?2 AND '+state;
 const audit=db.prepare("INSERT INTO audit_events(id,user_id,action,resource_type,resource_id,metadata_json,created_at) SELECT ?3,?4,'operations.job.replay',?5,?1,?6,?7 FROM "+table+' WHERE '+predicate).bind(input.id,input.expectedUpdatedAt,crypto.randomUUID(),adminId,input.kind,JSON.stringify({reason:input.reason,previousUpdatedAt:input.expectedUpdatedAt}),now);
 const statements=[audit];
 if(input.kind==='billing')statements.push(db.prepare("UPDATE webhook_events SET state='retryable_failed',last_error_code='manual_replay' WHERE provider_event_id=?1 AND EXISTS(SELECT 1 FROM billing_event_jobs WHERE "+predicate+")").bind(input.id,input.expectedUpdatedAt));
 const update=input.kind==='billing'?"state='queued',attempts=0,lease_token=NULL,lease_until=NULL,error_code='manual_replay'":"status='queued',attempt_count=0,lease_token=NULL,processing_started_at=NULL,completed_at=NULL,logical_key='active:'||connection_id,last_error_code='manual_replay'";
 statements.push(db.prepare('UPDATE '+table+' SET '+update+',next_attempt_at=?3,updated_at=?3 WHERE '+predicate).bind(input.id,input.expectedUpdatedAt,now));
 const results=await db.batch(statements);return results.at(-1)?.meta.changes===1;
}
