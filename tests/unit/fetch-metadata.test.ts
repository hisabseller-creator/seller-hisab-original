import {vi,it,expect} from 'vitest';
vi.mock('@/server/runtime',()=>({runtimeEnv:()=>({}),appEnvironment:()=> 'production'}));
import {requestHasSameOrigin} from '@/server/admin';
it('blocks sibling/cross-site cookie mutations and preserves server callbacks',()=>{
 const req=(headers:Record<string,string>)=>new Request('https://sellerhisab.com/api/test',{method:'POST',headers});
 expect(requestHasSameOrigin(req({'sec-fetch-site':'same-site'}))).toBe(false);
 expect(requestHasSameOrigin(req({'origin':'null'}))).toBe(false);
 expect(requestHasSameOrigin(req({'cookie':'smg_session=test'}))).toBe(false);
 expect(requestHasSameOrigin(req({'cookie':'smg_session=test','sec-fetch-site':'same-origin'}))).toBe(true);
 expect(requestHasSameOrigin(req({}))).toBe(true);
});
