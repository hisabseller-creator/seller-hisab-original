import {z} from 'zod';
import {getSessionUser} from '@/server/auth';
import {requestHasSameOrigin} from '@/server/admin';
import {requirePaidCapability} from '@/server/plan-access';
import {requireWorkspaceCapability} from '@/server/workspace-access';
import {enforceRateLimit} from '@/server/rate-limit';
import {createOauthState} from '@/server/connectors/store';
import {normalizeWooCommerceStoreUrl} from '@/core/connectors/woocommerce';
import {runtimeEnv} from '@/server/runtime';
export async function POST(request:Request){
 const user=await getSessionUser(request);if(!user)return new Response(null,{status:401});if(!requestHasSameOrigin(request))return new Response(null,{status:403});
 try{
  await requirePaidCapability(user,'connectors');await requireWorkspaceCapability(user,'connector_manage');await enforceRateLimit(request,'wc-auth-start',user.id,8,3600);
  const input=z.object({storeUrl:z.string().max(240)}).parse(await request.json()),storeUrl=normalizeWooCommerceStoreUrl(input.storeUrl);if(!storeUrl)throw Error('Invalid store');
  const origin=new URL(runtimeEnv().CONNECTOR_CALLBACK_ORIGIN||'https://sellerhisab.com').origin;if(!origin.startsWith('https://'))throw Error('Invalid callback');
  const state=await createOauthState({user,connectorId:'woocommerce-v1',context:{storeUrl},ttlMinutes:10});
  const url=new URL(storeUrl+'/wc-auth/v1/authorize');url.search=new URLSearchParams({app_name:'SellerHisab',scope:'read',user_id:state,return_url:origin+'/app?view=connections',callback_url:origin+'/api/connectors/woocommerce/callback'}).toString();
  return Response.json({authorizationUrl:url.toString()},{headers:{'cache-control':'no-store'}});
 }catch{return Response.json({error:'Read-only authorization could not be started. Check your store, plan and workspace permissions.'},{status:400});}
}
