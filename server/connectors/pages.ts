import {mapAmazonFinances2024,mapAmazonFinancialEventGroupsV0,mapShopifyPaymentsGraphql} from '@/core/connectors/financial-mappers';
import {mapAmazonOrdersApi2026,mapFlipkartShipmentsV3} from '@/core/connectors/official-order-mappers';
import {mapShopifyOrdersGraphql} from '@/core/connectors/api-runtime';
import {mapWooCommerceOrders} from '@/core/connectors/woocommerce';
import type {PageCheckpoint} from '@/core/connectors/coverage';
import type {SyncData} from './sync';
import type {OwnedConnection,StoredConnectorCredential} from './store';
import {amazonSpApiGet,shopifyGraphql,flipkartApi,woocommerceApiGet,providerConstants} from './providers';
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const arr=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
function token(p:unknown){const r=obj(p),b=obj(r.payload),pg=obj(r.pagination??b.pagination);return String(r.paginationToken??b.paginationToken??pg.paginationToken??r.nextToken??b.nextToken??pg.nextToken??r.NextToken??b.NextToken??'');}
function cursor(p:unknown):string{const info=obj(p);if(typeof info.hasNextPage!=='boolean')throw Error('pagination_metadata_missing');if(!info.hasNextPage)return '';if(typeof info.endCursor!=='string'||!info.endCursor)throw Error('pagination_cursor_missing');return info.endCursor;}
export async function fetchConnectorPage(credential:StoredConnectorCredential,connection:OwnedConnection,c:PageCheckpoint):Promise<{data:SyncData;next:string;stages:number;source:'orders'|'finance'|'payouts'}>{
 const data:SyncData={events:[],evidence:[],batches:[],issues:[]};
 const options={sourceFingerprint:'api:'+connection.connectorId+':'+connection.id,channelAccountId:connection.channelAccountId??undefined};
 let next='',stages=3,source:'orders'|'finance'|'payouts'=c.stage===0?'orders':c.stage===1?'finance':'payouts';
 if(connection.connectorId==='woocommerce-v1'){
  stages=1;source='orders';
  const page=Number(c.cursor||1);
  const p=await woocommerceApiGet(credential,'/orders',new URLSearchParams({after:c.sliceStart,before:c.sliceEnd,dates_are_gmt:'true',per_page:'100',page:String(page),orderby:'date',order:'asc'}));
  if(!Array.isArray(p))throw Error('malformed_orders_response');
  const mapped=mapWooCommerceOrders(p,options);data.events=mapped.events;data.issues=mapped.issues;next=p.length===100?String(page+1):'';
  c.financeComplete=false;c.payoutsComplete=false;c.warnings.push('WooCommerce payout/settlement evidence requires validated finance files.');
 }else if(connection.connectorId==='amazon-in-v1'){
  let path:string,params:URLSearchParams;
  if(c.stage===0){path='/orders/2026-01-01/orders';params=new URLSearchParams({marketplaceIds:providerConstants.AMAZON_INDIA_MARKETPLACE_ID,createdAfter:c.sliceStart,createdBefore:c.sliceEnd,includedData:'PROCEEDS',maxResultsPerPage:'100'});if(c.cursor)params.set('paginationToken',c.cursor);}
  else if(c.stage===1){path='/finances/2024-06-19/transactions';params=new URLSearchParams({postedAfter:c.sliceStart,postedBefore:c.sliceEnd,marketplaceId:providerConstants.AMAZON_INDIA_MARKETPLACE_ID});if(c.cursor)params.set('nextToken',c.cursor);}
  else {path='/finances/v0/financialEventGroups';params=new URLSearchParams({FinancialEventGroupStartedAfter:c.sliceStart,FinancialEventGroupStartedBefore:c.sliceEnd,MaxResultsPerPage:'100'});if(c.cursor)params.set('NextToken',c.cursor);}
  const p=await amazonSpApiGet(credential,path,params);const b=obj(p.payload??p);
  if(c.stage===0){if(!Array.isArray(b.orders)&&!Array.isArray(b.Orders))throw Error('malformed_orders_response');const m=mapAmazonOrdersApi2026(p,options);data.events=m.events;data.issues=m.issues;}
  else if(c.stage===1){if(!Array.isArray(b.transactions))throw Error('malformed_finance_response');const m=mapAmazonFinances2024(p,options);data.evidence=m.evidence;data.issues=m.issues;}
  else {if(!Array.isArray(b.FinancialEventGroupList))throw Error('malformed_payout_response');const m=mapAmazonFinancialEventGroupsV0(p,options);data.batches=m.batches;data.issues=m.issues;}
  next=token(p);
 }else if(connection.connectorId==='shopify-v1'){
  if(c.stage===0&&c.cursor.startsWith('lines:')){
   const pending=JSON.parse(c.cursor.slice(6)) as {after:string;orders:{id:string;cursor:string}[]};
   const current=pending.orders[0];if(!current?.id||!current.cursor)throw Error('invalid_line_checkpoint');
   const p=await shopifyGraphql(credential,'query SellerHisabLines($id:ID!,$after:String!) { order(id:$id) { id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus lineItems(first:250,after:$after) { nodes { id sku quantity discountedUnitPriceAfterAllDiscountsSet {shopMoney {amount currencyCode}} } pageInfo {hasNextPage endCursor} } } }',{id:current.id,after:current.cursor});
   if(typeof p.nextReadAt==='string')c.notBefore=p.nextReadAt;
   const order=obj(obj(p.data).order),lines=obj(order.lineItems);
   if(order.id!==current.id||!Array.isArray(lines.nodes))throw Error('malformed_order_lines');
   const after=cursor(lines.pageInfo);if(after===current.cursor)throw Error('pagination_cursor_repeated');
   // These are page observations. Coverage stays unconfirmed until every queued
   // line page and finance/payout page has committed successfully.
   const m=mapShopifyOrdersGraphql({data:{orders:{nodes:[{...order,lineItems:{...lines,pageInfo:{hasNextPage:false}}}]}}},options);
   data.events=m.events;data.issues=m.issues;
   if(after)current.cursor=after;else pending.orders.shift();
   next=pending.orders.length?'lines:'+JSON.stringify(pending):pending.after;
   if(data.issues.length){c.ordersComplete=false;c.warnings.push('Provider rows need validation: orders');}
   return {data,next,stages,source:'orders'};
  }
  const field=c.stage===0?'orders':c.stage===1?'balanceTransactions':'payouts';
  if(c.stage>0&&!/(^|,)read_shopify_payments(_accounts)?(,|$)/.test(credential.scope??'')){
   c.financeComplete=false;c.payoutsComplete=false;c.warnings.push('Shopify Payments scope missing; finance evidence is incomplete.');return {data,next:'',stages,source};
  }
  const selection=c.stage===0?'id name createdAt cancelledAt displayFinancialStatus displayFulfillmentStatus lineItems(first:250) { nodes { id sku quantity discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount currencyCode } } } pageInfo { hasNextPage endCursor } }':c.stage===1?'id type test transactionDate processedAt associatedPayout {id status} net {amount currencyCode} associatedOrder {id name}':'id status issuedAt externalTraceId transactionType net {amount currencyCode}';
  const dateField=c.stage===0?(c.orderDateField??'created_at'):c.stage===1?'processed_at':'issued_at';
  const selectionQuery=field+'(first:50,after:$after,query:$query) { nodes { '+selection+' } pageInfo { hasNextPage endCursor } }';
  const query='query SellerHisabPage($after:String,$query:String!) { '+(c.stage>0?'shopifyPaymentsAccount { '+selectionQuery+' }':selectionQuery)+' }';
  const p=await shopifyGraphql(credential,query,{after:c.cursor||null,query:dateField+':>='+c.sliceStart+' '+dateField+':<='+c.sliceEnd});
  if(typeof p.nextReadAt==='string')c.notBefore=p.nextReadAt;
  const owner=c.stage===0?obj(p.data):obj(obj(p.data).shopifyPaymentsAccount),page=obj(owner[field]);
  if(!Array.isArray(page.nodes))throw Error('malformed_shopify_response');
  next=cursor(page.pageInfo);
  if(c.stage===0){
   const pending:{id:string;cursor:string}[]=[];
   const nodes=arr(page.nodes).map(n=>{const order=obj(n),lines=obj(order.lineItems);if(!Array.isArray(lines.nodes))throw Error('malformed_order_lines');const after=cursor(lines.pageInfo);if(after){if(typeof order.id!=='string')throw Error('missing_order_id');pending.push({id:order.id,cursor:after});}return {...order,lineItems:{...lines,pageInfo:{hasNextPage:false}}};});
   if(pending.length)next='lines:'+JSON.stringify({after:next,orders:pending});
   const m=mapShopifyOrdersGraphql({data:{orders:{nodes}}},options);data.events=m.events;data.issues=m.issues;
  }else {const m=mapShopifyPaymentsGraphql(p,options);data.evidence=m.evidence;data.batches=m.batches;data.issues=m.issues;}
 }else {
  stages=6;source='orders';
  const filters=[{type:'preDispatch',states:['APPROVED','PACKED','READY_TO_DISPATCH']},{type:'postDispatch',states:['SHIPPED','DELIVERED','PICKUP_COMPLETE'],shipmentTypes:['NORMAL']},{type:'postDispatch',states:['SHIPPED','DELIVERED','PICKUP_COMPLETE'],shipmentTypes:['SELF']},...['marketplaceCancellation','sellerCancellation','buyerCancellation'].map(cancellationType=>({type:'cancelled',states:['CANCELLED'],cancellationType}))];
  const url=new URL(c.cursor||'https://api.flipkart.net/sellers/v3/shipments/filter/','https://api.flipkart.net');
  if(url.origin!=='https://api.flipkart.net'||url.username||url.password)throw Error('unsafe_pagination_url');
  const p=await flipkartApi({credential,url:url.toString(),method:c.cursor?'GET':'POST',body:c.cursor?undefined:{filter:{...filters[c.stage],orderDate:{from:c.sliceStart,to:c.sliceEnd}},pagination:{pageSize:20}}});
  const b=obj(p.response??p);if(!Array.isArray(b.shipments))throw Error('malformed_shipments_response');
  const m=mapFlipkartShipmentsV3({shipments:b.shipments},options);data.events=m.events;data.issues=m.issues;
  next=String(p.nextPageUrl??p.next_page_url??b.nextPageUrl??b.next_page_url??'');
  c.financeComplete=false;c.payoutsComplete=false;c.warnings.push('Flipkart settlement evidence requires validated finance files.');
 }
 if(next&&next===c.cursor)throw Error('pagination_cursor_repeated');
 if(data.issues.length){if(source==='orders')c.ordersComplete=false;else if(source==='finance')c.financeComplete=false;else c.payoutsComplete=false;c.warnings.push('Provider rows need validation: '+source);}
 return {data,next,stages,source};
}
