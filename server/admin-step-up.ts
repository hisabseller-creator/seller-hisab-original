import {getD1,runtimeEnv} from './runtime';
import {sha256,signToken,verifyToken} from './crypto';
import type {SessionUser} from './auth';
const MAX_AGE=10*60*1000;
function cookie(request:Request,name:string){return (request.headers.get('cookie')??'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)??'';}
export async function hasAdminStepUp(request:Request,user:SessionUser){
 const secret=runtimeEnv().SESSION_SECRET;if(!secret)return false;
 const token=cookie(request,'smg_session');if(!token)return false;
 const tokenHash=await sha256(token+':'+secret);
 const session=await getD1().prepare('SELECT created_at AS createdAt FROM sessions WHERE token_hash=?1 AND user_id=?2 AND expires_at>?3').bind(tokenHash,user.id,Date.now()).first<{createdAt:string}>();
 if(!session)return false;
 const age=Date.now()-Date.parse(session.createdAt);if(age>=0&&age<=MAX_AGE)return true;
 const proof=await verifyToken<{uid:string;session:string;credential:string;purpose:string;exp:number}>(cookie(request,'smg_admin_stepup'),secret);
 if(!proof||proof.purpose!=='admin-step-up'||!proof.exp||proof.exp>Date.now()+MAX_AGE||proof.uid!==user.id||proof.session!==tokenHash)return false;
 const row=await getD1().prepare('SELECT password_hash AS passwordHash FROM users WHERE id=?1 AND deleted_at IS NULL').bind(user.id).first<{passwordHash:string}>();
 return Boolean(row&&proof.credential===await sha256(row.passwordHash));
}
export async function issueAdminStepUp(request:Request,userId:string,passwordHash:string){
 const secret=runtimeEnv().SESSION_SECRET!;
 const proof=await signToken({uid:userId,session:await sha256(cookie(request,'smg_session')+':'+secret),credential:await sha256(passwordHash),purpose:'admin-step-up',exp:Date.now()+MAX_AGE},secret);
 return 'smg_admin_stepup='+proof+'; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Strict';
}
