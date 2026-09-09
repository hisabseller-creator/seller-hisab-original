import {getD1} from './runtime';
import {randomId} from './crypto';
import {razorpayJson} from './razorpay';
type Intent={id:string;userId:string;amount:number;currency:string;state:string;orderId:string|null};
export async function createLogicalOrder(input:{analysisId:string;userId:string;amount:number;analysisRef:string}):Promise<{orderId?:string;amount:number;state:string;intentId:string}>{
 const db=getD1(),id=randomId('pi'),now=new Date().toISOString();
 const claim=await db.prepare("INSERT OR IGNORE INTO payment_intents(id,analysis_id,product,user_id,amount_paise,currency,state,created_at,updated_at) VALUES (?1,?2,'action_report',?3,?4,'INR','creating',?5,?5)").bind(id,input.analysisId,input.userId,input.amount,now).run();
 const intent=await db.prepare("SELECT id,user_id AS userId,amount_paise AS amount,currency,state,provider_order_id AS orderId FROM payment_intents WHERE analysis_id=?1 AND product='action_report'").bind(input.analysisId).first<Intent>();
 if(!intent||intent.userId!==input.userId)throw Error('This payment attempt belongs to another account.');
 if(intent.orderId)return {orderId:intent.orderId,amount:intent.amount,state:intent.state,intentId:intent.id};
 if(claim.meta.changes!==1)return {amount:intent.amount,state:'pending_review',intentId:intent.id};
 try{
  const order=await razorpayJson<{id:string;amount:number;currency:string;status:string}>('/v1/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount:intent.amount,currency:intent.currency,receipt:id,notes:{product:'action_report',analysis_ref:input.analysisRef}})});
  if(!order.id||order.amount!==intent.amount||order.currency!=='INR'||order.status!=='created')throw Error('Provider order mismatch');
  await db.batch([
   db.prepare("INSERT INTO payments (id,provider_order_id,analysis_id,user_id,product,provider,amount_paise,currency,status,created_at,updated_at) VALUES (?1,?2,?3,?4,'action_report','razorpay',?5,'INR','created',?6,?6)").bind(id,order.id,input.analysisId,input.userId,intent.amount,now),
   db.prepare("UPDATE payment_intents SET state='ready',provider_order_id=?2,updated_at=?3 WHERE id=?1 AND state='creating'").bind(id,order.id,new Date().toISOString()),
  ]);
  return {orderId:order.id,amount:intent.amount,state:'ready',intentId:id};
 }catch{
  // A timed-out POST may already have created the order. Never automatically
  // repeat it or discard the reservation; reconcile by receipt with the provider.
  await db.prepare("UPDATE payment_intents SET state='pending_review',updated_at=?2 WHERE id=?1 AND state='creating'").bind(id,new Date().toISOString()).run();
  return {amount:intent.amount,state:'pending_review',intentId:id};
 }
}
