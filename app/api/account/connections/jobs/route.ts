import {getSessionUser} from '@/server/auth';
import {getWorkspaceAccess} from '@/server/workspace-access';
import {getD1} from '@/server/runtime';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const user=await getSessionUser(request);if(!user)return new Response(null,{status:401});
 const access=await getWorkspaceAccess(user.id);if(!access)return new Response(null,{status:403});
 const id=new URL(request.url).searchParams.get('id');if(!id||id.length>100)return new Response(null,{status:400});
 const job=await getD1().prepare('SELECT id,status,attempt_count AS attempts,next_attempt_at AS nextAttemptAt,last_error_code AS errorCode,created_at AS createdAt,updated_at AS updatedAt,coverage_json AS coverageJson FROM connector_sync_jobs WHERE id=?1 AND tenant_id=?2').bind(id,access.tenantId).first<{status:string;coverageJson:string|null}>();
 if(!job)return new Response(null,{status:404});
 const states:Record<string,string>={processing:'running',retryable_failed:'retrying',completed:'complete',dead_letter:'failed',terminal_failed:'failed'};
 return Response.json({...job,coverageJson:undefined,coverage:job.coverageJson?JSON.parse(job.coverageJson):null,status:states[job.status]??job.status},{headers:{'cache-control':'no-store'}});
}
