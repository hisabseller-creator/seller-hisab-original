import {z} from 'zod';
import {boundedText} from '@/server/request-body';
import {consumeOauthStateForCallback,upsertConnectedAccount} from '@/server/connectors/store';
import {woocommerceApiGet} from '@/server/connectors/providers';
import {normalizeWooCommerceStoreUrl,validWooCommerceConsumerKey,validWooCommerceConsumerSecret} from '@/core/connectors/woocommerce';
export async function POST(request:Request){
 try{
  const input=z.object({user_id:z.string().min(20).max(100),consumer_key:z.string().max(160),consumer_secret:z.string().max(160),key_permissions:z.literal('read')}).parse(JSON.parse(await boundedText(request,4096)));
  if(!validWooCommerceConsumerKey(input.consumer_key)||!validWooCommerceConsumerSecret(input.consumer_secret))throw Error('Invalid key');
  // wc-auth has no signed webhook. Its one-use random user_id is a bearer
  // callback capability, sent in the HTTPS body and never logged or exported.
  const state=await consumeOauthStateForCallback({connectorId:'woocommerce-v1',state:input.user_id});if(!state)throw Error('Invalid state');
  const storeUrl=normalizeWooCommerceStoreUrl(String(state.context.storeUrl));if(!storeUrl)throw Error('Invalid store');
  const credential={provider:'woocommerce' as const,storeUrl,consumerKey:input.consumer_key,consumerSecret:input.consumer_secret,scope:'read'};
  const probe=await woocommerceApiGet(credential,'/orders',new URLSearchParams({per_page:'1',page:'1'}));if(!Array.isArray(probe))throw Error('Invalid probe');
  await upsertConnectedAccount({userId:state.userId,tenantId:state.tenantId,connectorId:'woocommerce-v1',channelId:'woocommerce',externalAccountId:storeUrl,displayName:new URL(storeUrl).hostname,mode:'seller-api',enabledCapabilities:['read-orders'],grantedScopes:['read'],credential});
  return Response.json({success:true},{status:201});
 }catch{return Response.json({error:'Authorization could not be verified. Restart connection from SellerHisab.'},{status:400});}
}
