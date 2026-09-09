import {it,expect,vi,beforeEach} from 'vitest';
import {testDatabase} from '../helpers/d1';
const state=vi.hoisted(()=>({db:null as D1Database|null,fulfil:vi.fn()}));
vi.mock('@/server/runtime',()=>({getD1:()=>state.db}));
vi.mock('@/server/billing',()=>({BillingProcessingError:class extends Error{constructor(public code:string,public retryable:boolean){super(code);}},fulfilVerifiedOneTimePayment:state.fulfil,writeBillingAudit:vi.fn(),reconcileSubscriptionFromProvider:vi.fn()}));
vi.mock('@/server/trials',()=>({markTrialSubscriptionCharged:vi.fn()}));
import {processEvent} from '@/server/billing-event-processing';
beforeEach(()=>{state.db=testDatabase().d1;state.fulfil.mockReset();});
it('defers an early captured event until local order recovery is available',async()=>{
 const payload={payload:{payment:{entity:{id:'pay_ok',order_id:'order_ok'}}}};
 await expect(processEvent('event','payment.captured',payload)).rejects.toMatchObject({code:'capture_payment_not_mapped',retryable:true});
 await state.db!.prepare("INSERT INTO payments(id,analysis_id,provider_order_id,product,provider,amount_paise,currency,status,created_at,updated_at) VALUES('p','ana','order_ok','action_report','razorpay',4900,'INR','created','2026','2026')").run();
 await processEvent('event','payment.captured',payload);expect(state.fulfil).toHaveBeenCalledWith({providerOrderId:'order_ok',providerPaymentId:'pay_ok',providerEventId:'event'});
});
it.each(['paid','disputed','refunded'])('a late failed attempt preserves %s state and captured identity',async(status)=>{
 await state.db!.prepare("INSERT INTO payments(id,analysis_id,provider_order_id,provider_payment_id,provider_status,product,provider,amount_paise,currency,status,created_at,updated_at) VALUES('p','ana','order_ok','pay_captured','captured','action_report','razorpay',4900,'INR',?1,'2026','2026')").bind(status).run();
 await processEvent('event','payment.failed',{payload:{payment:{entity:{id:'pay_failed',order_id:'order_ok'}}}});
 expect(await state.db!.prepare('SELECT status,provider_payment_id AS payment FROM payments').first()).toEqual({status,payment:'pay_captured'});
});
it.each(['refund.processed','payment.dispute.created'])('retains an unmapped %s for retry/replay',async(event)=>{await expect(processEvent('event',event,{payload:{payment:{entity:{id:'pay_early'}}}})).rejects.toMatchObject({retryable:true});});
