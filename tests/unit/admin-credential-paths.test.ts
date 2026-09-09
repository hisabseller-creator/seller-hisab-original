import {vi,it,expect,beforeEach} from 'vitest';
import {testDatabase} from '../helpers/d1';
const state=vi.hoisted(()=>({db:null as D1Database|null,session:vi.fn()}));
vi.mock('@/server/runtime',()=>({getD1:()=>state.db,appEnvironment:()=> 'production',runtimeEnv:()=>({ADMIN_EMAILS:'admin@example.invalid',ADMIN_PHONES:'919876543210',APP_ENV:'production'})}));
vi.mock('@/server/auth',()=>({createSession:state.session,revokeAllSessionsForUser:vi.fn()}));
vi.mock('@/server/msg91-widget',()=>({verifyMsg91WidgetAccessToken:vi.fn()}));
vi.mock('@/server/rate-limit',()=>({enforceRateLimit:vi.fn(),enforceIpRateLimit:vi.fn(),RateLimitError:class extends Error{}}));
import {POST} from '@/app/api/auth/mobile/widget-complete/route';
beforeEach(()=>{state.db=testDatabase().d1;state.session.mockReset().mockResolvedValue({cookie:'fixture-session'});});
function request(mode:'register'|'reset_password',phone='9876543210',password='Weakpass1',email?:string){return new Request('https://sellerhisab.com/api/auth/mobile/widget-complete',{method:'POST',headers:{origin:'https://sellerhisab.com','content-type':'application/json'},body:JSON.stringify({accessToken:'fixture-token-long-enough-to-verify',phone,mode,password,email,name:'Fixture Seller',city:'Test City',acceptedTerms:true})});}
for(const mode of ['register','reset_password'] as const)for(const identity of ['phone','email'] as const)it('enforces admin policy for existing '+identity+' identity during '+mode,async()=>{
 const phone=identity==='phone'?'919876543210':'919999999999',email=identity==='email'?'admin@example.invalid':'seller@example.invalid';
 await state.db!.prepare('INSERT INTO users(id,email,phone,password_hash,created_at) VALUES(?1,?2,?3,?4,?5)').bind('u',email,phone,'existing-hash','2026-01-01').run();
 expect((await POST(request(mode,phone))).status).toBe(400);
 expect(await state.db!.prepare('SELECT password_hash FROM users').first()).toEqual({password_hash:'existing-hash'});expect(state.session).not.toHaveBeenCalled();
});
it('blocks a new user claiming an unverified allowlisted email',async()=>{expect((await POST(request('register','9999999999','StrongPassword123!','admin@example.invalid'))).status).toBe(403);expect(await state.db!.prepare('SELECT id FROM users').first()).toBeNull();});
it('preserves ordinary seller password policy',async()=>{expect((await POST(request('register','9999999999','Seller123'))).status).toBe(200);expect(state.session).toHaveBeenCalledTimes(1);});
it('enforces policy for first registration of an allowlisted phone',async()=>{expect((await POST(request('register'))).status).toBe(400);expect(await state.db!.prepare('SELECT id FROM users').first()).toBeNull();});
