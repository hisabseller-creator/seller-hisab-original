import {boundedText,BodyTooLargeError} from '@/server/request-body';
import {constantTimeEqual,hmacSha256,sha256} from '@/server/crypto';
import {getD1,runtimeEnv} from '@/server/runtime';
import {normalizeShopifyShop} from '@/core/connectors/api-runtime';
export async function POST(request:Request){
 const secret=runtimeEnv().SHOPIFY_CLIENT_SECRET;if(!secret)return new Response(null,{status:503});
 try{
  const raw=await boundedText(request),hex=await hmacSha256(secret,raw),expected=btoa(String.fromCharCode(...hex.match(/../g)!.map(v=>parseInt(v,16))));
  if(!constantTimeEqual(expected,request.headers.get('x-shopify-hmac-sha256')??''))return new Response(null,{status:401});
  const shop=normalizeShopifyShop(request.headers.get('x-shopify-shop-domain')??'');
  const eventId=request.headers.get('x-shopify-event-id')??request.headers.get('x-shopify-webhook-id');
  if(!shop||!eventId||eventId.length>200)return new Response(null,{status:400});
  const topic=request.headers.get('x-shopify-topic');if(!['orders/create','orders/updated','orders/cancelled','refunds/create'].includes(topic??''))return Response.json({ignored:true});
  JSON.parse(raw);
  // Freshness queries use updated_at, so refunds/edits of old orders are included.
  const days=30;
  const now=new Date().toISOString(),db=getD1();
  const connections=await db.prepare("SELECT cc.id FROM connector_connections cc JOIN channel_accounts ca ON ca.id=cc.channel_account_id AND ca.tenant_id=cc.tenant_id WHERE cc.connector_id='shopify-v1' AND ca.external_account_id=?1 AND cc.status<>'disabled'").bind(shop).all<{id:string}>();
  for(const c of connections.results??[])await db.prepare("INSERT OR IGNORE INTO connector_notifications(id,connection_id,received_at,history_days,updated_at) VALUES(?1,?2,?3,?4,?3)").bind(await sha256('shopify:'+eventId+':'+c.id),c.id,now,Math.min(days,3650)).run();
  return Response.json({accepted:true});
 }catch(error){if(error instanceof SyntaxError||error instanceof BodyTooLargeError)return new Response(null,{status:400});console.error(JSON.stringify({event:'connector.notification.failure',provider:'shopify'}));return new Response(null,{status:503});}
}
