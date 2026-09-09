import {releaseBuild} from './release';
import {getD1,runtimeEnv} from './runtime';
export function ageSeconds(value:unknown,now=Date.now()):number|null{if(typeof value!=='string')return null;const stamp=Date.parse(value);return Number.isFinite(stamp)?Math.max(0,Math.floor((now-stamp)/1000)):null;}
export async function operationalSignals(){
 const db=getD1(),now=Date.now();
 const [billing,connectors,subscriptions,payments,intents,notifications,ledger,media]=await Promise.all([
  db.prepare("SELECT state,COUNT(*) AS count,MIN(created_at) AS oldest,MIN(updated_at) AS oldestProgress FROM billing_event_jobs GROUP BY state").all<Record<string,unknown>>(),
  db.prepare("SELECT status,COUNT(*) AS count,MIN(created_at) AS oldest,MIN(updated_at) AS oldestProgress FROM connector_sync_jobs GROUP BY status").all<Record<string,unknown>>(),
  db.prepare("SELECT COUNT(*) AS count,MIN(COALESCE(reconciliation_checked_at,created_at)) AS oldest FROM subscriptions WHERE status NOT IN ('cancelled','completed','expired')").first<Record<string,unknown>>(),
  db.prepare("SELECT COUNT(*) AS count,MIN(COALESCE(reconciliation_checked_at,created_at)) AS oldest FROM payments WHERE provider='razorpay' AND provider_payment_id IS NOT NULL AND status NOT IN ('refunded','disputed')").first<Record<string,unknown>>(),
  db.prepare("SELECT state,COUNT(*) AS count,MIN(created_at) AS oldest,MIN(updated_at) AS oldestProgress FROM payment_intents WHERE state IN ('creating','pending_review') GROUP BY state").all<Record<string,unknown>>(),
  db.prepare("SELECT state,COUNT(*) AS count,MIN(received_at) AS oldest,MIN(updated_at) AS oldestProgress FROM connector_notifications WHERE state<>'complete' GROUP BY state").all<Record<string,unknown>>(),
  db.prepare("SELECT COUNT(*) AS rows FROM commerce_ledger_entries").first(),
  db.prepare("SELECT COUNT(*) AS rows FROM blog_posts WHERE image_url<>''").first(),
 ]);
 const ages=(row:Record<string,unknown>)=>({...row,oldestAgeSeconds:ageSeconds(row.oldest,now),oldestProgressAgeSeconds:ageSeconds(row.oldestProgress,now)});
 const version=runtimeEnv().CF_VERSION_METADATA;
 return {checkedAt:new Date(now).toISOString(),build:releaseBuild,version:version?{id:version.id,tag:version.tag,timestamp:version.timestamp}:null,billing:billing.results.map(ages),connectors:connectors.results.map(ages),reconciliation:{subscriptions:subscriptions?ages(subscriptions):null,payments:payments?ages(payments):null},paymentIntents:intents.results.map(ages),notifications:notifications.results.map(ages),capacity:{ledger,publicMediaReferences:media,storageBytes:'Cloudflare D1/R2 account metrics required; reference counts are not bucket/database byte usage'}};
}
