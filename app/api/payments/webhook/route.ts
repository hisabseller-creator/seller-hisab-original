import { boundedText,BodyTooLargeError } from '@/server/request-body';
import { constantTimeEqual,hmacSha256,sha256 } from '@/server/crypto';
import { getD1,runtimeEnv } from '@/server/runtime';
import { projectBillingEvent } from '@/server/billing-jobs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const signature=request.headers.get('x-razorpay-signature')??'';
 if(!signature)return Response.json({error:'Invalid webhook signature.'},{status:400});
 const secret=runtimeEnv().RAZORPAY_WEBHOOK_SECRET;
 if(!secret)return Response.json({error:'Webhook is not configured.'},{status:503});
 if(Number(request.headers.get('content-length')??0)>262144)return new Response(null,{status:413});
 let raw:string;try{raw=await boundedText(request);}catch(error){return new Response(null,{status:error instanceof BodyTooLargeError?413:400});}
 if(!constantTimeEqual(await hmacSha256(secret,raw),signature))return Response.json({error:'Invalid webhook signature.'},{status:400});
 let projected:ReturnType<typeof projectBillingEvent>;
 try{projected=projectBillingEvent(JSON.parse(raw));}catch{return Response.json({error:'Invalid event.'},{status:400});}
 const hash=await sha256(raw),id=request.headers.get('x-razorpay-event-id')??hash;
 if(id.length>200)return new Response(null,{status:400});
 const now=new Date().toISOString(),db=getD1();
 // Atomic receipt + outbox: queue/network downtime cannot lose a verified event.
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO webhook_events (provider_event_id,event_type,payload_hash,received_at,state,attempt_count) VALUES (?1,?2,?3,?4,'received',0)").bind(id,projected.event,hash,now),
  db.prepare("INSERT OR IGNORE INTO billing_event_jobs (event_id,payload_json,next_attempt_at,created_at,updated_at) SELECT ?1,?2,?3,?3,?3 FROM webhook_events WHERE provider_event_id=?1 AND payload_hash=?4 AND state NOT IN ('completed','terminal_failed')").bind(id,JSON.stringify(projected),now,hash),
 ]);
 const saved=await db.prepare('SELECT payload_hash AS payloadHash FROM webhook_events WHERE provider_event_id=?1').bind(id).first<{payloadHash:string}>();
 if(saved?.payloadHash!==hash)return Response.json({error:'Webhook event payload mismatch.'},{status:400});
 // Scheduled dispatcher publishes this D1 outbox. No provider/queue call delays ACK.
 return Response.json({ok:true,queued:true});
}
