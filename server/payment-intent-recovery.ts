import {getD1} from './runtime';
import {razorpayJson,type RazorpayOrder} from './razorpay';
/** Recovery uses receipt lookup only. Absence never authorizes another POST. */
export async function reconcilePaymentIntents(){
 const db=getD1(),before=new Date(Date.now()-300000).toISOString();
 const rows=await db.prepare("SELECT id,analysis_id AS analysisId,user_id AS userId,amount_paise AS amount,currency FROM payment_intents WHERE state IN ('creating','pending_review') AND updated_at<?1 AND EXISTS(SELECT 1 FROM users WHERE users.id=payment_intents.user_id AND deleted_at IS NULL) ORDER BY updated_at,id LIMIT 20").bind(before).all<{id:string;analysisId:string;userId:string;amount:number;currency:string}>();
 for(const row of rows.results??[]){
  const now=new Date().toISOString();
  const claim=await db.prepare("UPDATE payment_intents SET state='pending_review',updated_at=?2 WHERE id=?1 AND state IN ('creating','pending_review') AND updated_at<?3").bind(row.id,now,before).run();if(claim.meta.changes!==1)continue;
  try{
   const result=await razorpayJson<{items:RazorpayOrder[]}>('/v1/orders?receipt='+encodeURIComponent(row.id)+'&count=100',{method:'GET'});
   if(!Array.isArray(result.items)||result.items.length!==1)continue;
   const order=result.items[0];
   if(order.receipt!==row.id||order.amount!==row.amount||order.currency!==row.currency||!/^order_[A-Za-z0-9]+$/.test(order.id)||!['created','attempted','paid'].includes(order.status))continue;
   await db.batch([
    db.prepare("INSERT OR IGNORE INTO payments(id,provider_order_id,analysis_id,user_id,product,provider,amount_paise,currency,status,created_at,updated_at) SELECT ?1,?2,?3,?4,'action_report','razorpay',?5,?6,'created',?7,?7 FROM payment_intents WHERE id=?1 AND state='pending_review' AND updated_at=?7 AND EXISTS(SELECT 1 FROM users WHERE users.id=payment_intents.user_id AND deleted_at IS NULL)").bind(row.id,order.id,row.analysisId,row.userId,row.amount,row.currency,now),
    db.prepare("UPDATE payment_intents SET state='ready',provider_order_id=?2 WHERE id=?1 AND state='pending_review' AND updated_at=?3 AND EXISTS(SELECT 1 FROM payments WHERE id=?1 AND provider_order_id=?2)").bind(row.id,order.id,now),
   ]);
   // Entitlement is still granted only by existing captured-payment verification.
  }catch{console.error(JSON.stringify({event:'payment.intent.reconciliation_failed'}));}
 }
}
