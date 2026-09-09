import {vi,it,expect,beforeEach} from 'vitest';
import {testDatabase} from '../helpers/d1';
const state=vi.hoisted(()=>({db:null as D1Database|null,create:vi.fn()}));
vi.mock('@/server/runtime',()=>({getD1:()=>state.db,runtimeEnv:()=>({RAZORPAY_WEBHOOK_SECRET:'fixture-webhook-secret'})}));
vi.mock('@/server/razorpay',()=>({razorpayJson:state.create}));
vi.mock('@/server/billing-event-processing',()=>({processEvent:vi.fn()}));
vi.mock('@/server/billing',()=>({BillingProcessingError:class extends Error{retryable=true;}}));
import {createLogicalOrder} from '@/server/payment-intents';
import {POST} from '@/app/api/payments/webhook/route';
import {hmacSha256} from '@/server/crypto';
beforeEach(()=>{const db=testDatabase();state.db=db.d1;db.sqlite.exec("INSERT INTO users(id,email,created_at) VALUES ('u','fixture@example.invalid','2026-01-01')");state.create.mockReset();});
it('reserves one logical purchase before concurrent provider side effects',async()=>{
 state.create.mockImplementation(async()=>{await new Promise(r=>setTimeout(r,10));return {id:'order_one',amount:4900,currency:'INR',status:'created'};});
 const input={analysisId:'ana_fixture',userId:'u',amount:4900,analysisRef:'opaque'};
 const results=await Promise.all(Array.from({length:12},()=>createLogicalOrder(input)));
 expect(state.create).toHaveBeenCalledTimes(1);expect(results.filter(r=>r.orderId)).toHaveLength(1);
 expect((await createLogicalOrder(input)).orderId).toBe('order_one');expect(state.create).toHaveBeenCalledTimes(1);
});
it('preserves an ambiguous order reservation without unsafe retry',async()=>{state.create.mockRejectedValue(new Error('timeout'));const i={analysisId:'ana_timeout',userId:'u',amount:4900,analysisRef:'opaque'};expect((await createLogicalOrder(i)).state).toBe('pending_review');await createLogicalOrder(i);expect(state.create).toHaveBeenCalledTimes(1);});
it('persists verified duplicate webhook once without calling provider',async()=>{
 const raw=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_x',order_id:'order_x',email:'private@example.invalid'}}}});
 const signature=await hmacSha256('fixture-webhook-secret',raw);
 const request=()=>new Request('https://sellerhisab.com/api/payments/webhook',{method:'POST',headers:{'x-razorpay-signature':signature,'x-razorpay-event-id':'evt_1'},body:raw});
 expect((await POST(request())).status).toBe(200);expect((await POST(request())).status).toBe(200);
 const row=await state.db!.prepare('SELECT payload_json AS payload FROM billing_event_jobs').first<{payload:string}>();expect(row?.payload).not.toContain('private@example');expect(state.create).not.toHaveBeenCalled();
});
