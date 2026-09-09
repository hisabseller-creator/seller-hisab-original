import {getD1,runtimeEnv} from './runtime';
import {processEvent,type RazorpayPayload} from './billing-event-processing';
import {BillingProcessingError} from './billing';
import {ProviderTransportError} from './provider-http';
export function projectBillingEvent(value:unknown):RazorpayPayload & {event:string}{
 if(!value||typeof value!=='object')throw Error('Invalid event');
 const v=value as RazorpayPayload;if(typeof v.event!=='string'||!v.event||v.event.length>100)throw Error('Invalid event');
 const p=v.payload?.payment?.entity;
 // Store only provider reconciliation references/status, never contacts/card/raw body.
 return {event:v.event,payload:{payment:p?{entity:{id:p.id,order_id:p.order_id,amount:p.amount,currency:p.currency,status:p.status}}:undefined,refund:{entity:{payment_id:v.payload?.refund?.entity?.payment_id}},dispute:{entity:{payment_id:v.payload?.dispute?.entity?.payment_id}},subscription:{entity:{id:v.payload?.subscription?.entity?.id}}}};
}
export async function processBillingJob(id:string):Promise<void>{
 const db=getD1(),now=new Date().toISOString(),lease=crypto.randomUUID();
 const claimed=await db.prepare("UPDATE billing_event_jobs SET state='running',attempts=attempts+1,lease_token=?2,lease_until=?3,updated_at=?4 WHERE event_id=?1 AND attempts<8 AND next_attempt_at<=?4 AND (state IN ('queued','retrying') OR (state='running' AND lease_until<?4))")
 .bind(id,lease,new Date(Date.now()+180000).toISOString(),now).run();
 if(claimed.meta.changes!==1)return;
 const row=await db.prepare('SELECT payload_json AS payload,attempts FROM billing_event_jobs WHERE event_id=?1 AND lease_token=?2').bind(id,lease).first<{payload:string;attempts:number}>();if(!row)return;
 try {
  const p=JSON.parse(row.payload) as RazorpayPayload;
  await processEvent(id,p.event!,p);
  await db.batch([
   db.prepare("UPDATE webhook_events SET state='completed',processed_at=?2,attempt_count=?3 WHERE provider_event_id=?1 AND EXISTS(SELECT 1 FROM billing_event_jobs WHERE event_id=?1 AND lease_token=?4)").bind(id,new Date().toISOString(),row.attempts,lease),
   db.prepare("UPDATE billing_event_jobs SET state='complete',payload_json='{}',lease_token=NULL,lease_until=NULL,updated_at=?3 WHERE event_id=?1 AND lease_token=?2").bind(id,lease,new Date().toISOString()),
  ]);
 }catch(error){
  const terminal=error instanceof BillingProcessingError&&!error.retryable;
  const dead=terminal||row.attempts>=8;
  const delay=Math.max(error instanceof ProviderTransportError?error.retryAfterMs:0,Math.min(3600000,15000*2**row.attempts)+Math.floor(Math.random()*1000));
  const code=terminal?'billing_terminal':'billing_provider_retry';
  const failed=await db.batch([
   db.prepare('UPDATE webhook_events SET state=?2,last_error_code=?3,attempt_count=?4,last_error_at=?5 WHERE provider_event_id=?1 AND EXISTS(SELECT 1 FROM billing_event_jobs WHERE event_id=?1 AND lease_token=?6)').bind(id,dead?'terminal_failed':'retryable_failed',code,row.attempts,new Date().toISOString(),lease),
   db.prepare('UPDATE billing_event_jobs SET state=?3,error_code=?4,next_attempt_at=?5,lease_token=NULL,lease_until=NULL,updated_at=?6 WHERE event_id=?1 AND lease_token=?2').bind(id,lease,dead?'dead_letter':'retrying',code,new Date(Date.now()+delay).toISOString(),new Date().toISOString()),
  ]);
  console.error(JSON.stringify({event:'billing.job.failure',code,state:dead?'dead_letter':'retrying',release:runtimeEnv().CF_VERSION_METADATA?.id??'local'}));
  if(dead && failed[1].meta.changes===1)await runtimeEnv().BILLING_DLQ?.send({kind:'billing',id});
 }
}
export async function dispatchBillingOutbox(){
 const queue=runtimeEnv().BILLING_QUEUE;if(!queue)return;
 const now=new Date().toISOString();
 await getD1().prepare("UPDATE billing_event_jobs SET state='dead_letter',error_code='lease_exhausted',lease_token=NULL,lease_until=NULL,updated_at=?1 WHERE state='running' AND attempts>=8 AND lease_until<?1").bind(now).run();
 await getD1().prepare("UPDATE webhook_events SET state='terminal_failed',last_error_code='lease_exhausted' WHERE provider_event_id IN (SELECT event_id FROM billing_event_jobs WHERE state='dead_letter' AND error_code='lease_exhausted')").run();
 const rows=await getD1().prepare("SELECT event_id AS id FROM billing_event_jobs WHERE attempts<8 AND next_attempt_at<=?1 AND (state IN ('queued','retrying') OR (state='running' AND lease_until<?1)) ORDER BY next_attempt_at,event_id LIMIT 100").bind(now).all<{id:string}>();
 for(const row of rows.results??[])await queue.send({kind:'billing',id:row.id});
}
