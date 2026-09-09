import {z} from 'zod';
import {requestHasSameOrigin} from '@/server/admin';
import {enforceIpRateLimit,RateLimitError} from '@/server/rate-limit';
import {runtimeEnv} from '@/server/runtime';
import {PERFORMANCE_ROUTES} from '@/core/performance';
const schema=z.object({name:z.enum(['LCP','INP','CLS']),value:z.number().finite().min(0).max(600000),route:z.enum(PERFORMANCE_ROUTES),device:z.enum(['mobile','desktop'])}).strict();
export async function POST(request:Request){
 if(!requestHasSameOrigin(request))return new Response(null,{status:403});
 try{
  if(Number(request.headers.get('content-length')??0)>1024)return new Response(null,{status:413});
  const raw=await request.text();if(raw.length>1024)return new Response(null,{status:413});
  const metric=schema.parse(JSON.parse(raw));
  await enforceIpRateLimit(request,'rum',60,60);
  console.log(JSON.stringify({event:'web.vital',...metric,release:runtimeEnv().CF_VERSION_METADATA?.id??'local'}));
  return new Response(null,{status:204});
 }catch(error){return new Response(null,{status:error instanceof RateLimitError?429:400});}
}
