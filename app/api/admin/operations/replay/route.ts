import {z} from 'zod';
import {getSessionUser} from '@/server/auth';
import {isAdminUser,requestHasSameOrigin} from '@/server/admin';
import {hasAdminStepUp} from '@/server/admin-step-up';
import {enforceRateLimit,RateLimitError} from '@/server/rate-limit';
import {boundedText} from '@/server/request-body';
import {replayFailedJob} from '@/server/job-replay';
const schema=z.object({kind:z.enum(['billing','connector']),id:z.string().min(1).max(200),expectedUpdatedAt:z.string().datetime(),reason:z.string().trim().min(20).max(300)}).strict();
export async function POST(request:Request){
 const user=await getSessionUser(request);if(!user)return new Response(null,{status:401});if(!isAdminUser(user.email,user.phone)||!requestHasSameOrigin(request))return new Response(null,{status:403});if(!await hasAdminStepUp(request,user))return Response.json({code:'admin_step_up_required',error:'Reconfirm admin access.'},{status:401});
 try{await enforceRateLimit(request,'admin-job-replay',user.id,10,3600);const input=schema.parse(JSON.parse(await boundedText(request,2048)));const replayed=await replayFailedJob(input,user.id);return Response.json({replayed,status:replayed?'queued':'unchanged'},{status:replayed?202:409});}catch(error){if(error instanceof RateLimitError)return Response.json({error:'Replay rate limit reached.'},{status:429});if(error instanceof z.ZodError||error instanceof SyntaxError)return Response.json({error:'Valid failed job, current update timestamp and review reason required.'},{status:400});return Response.json({error:'Replay could not be queued.'},{status:503});}
}
