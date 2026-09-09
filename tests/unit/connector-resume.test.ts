import {it,expect,vi,beforeEach} from 'vitest';
import {testDatabase} from '../helpers/d1';
import {seedConnector} from '../helpers/connector-fixture';
const state=vi.hoisted(()=>({db:null as D1Database|null,page:vi.fn(),send:vi.fn()}));
vi.mock('@/server/plan-access',()=>({hasPaidCapability:async()=>true}));
vi.mock('@/server/runtime',()=>({getD1:()=>state.db,runtimeEnv:()=>({CONNECTOR_QUEUE:{send:state.send}})}));
vi.mock('@/server/connectors/store',()=>({getConnectionById:async()=>({id:'c',tenantId:'t',channelAccountId:'ca',connectorId:'woocommerce-v1',status:'connected'}),loadCredential:async()=>({provider:'woocommerce'}),storeCredential:vi.fn()}));
vi.mock('@/server/connectors/providers',()=>({ensureFreshCredential:async(v:unknown)=>v}));
vi.mock('@/server/connectors/pages',()=>({fetchConnectorPage:state.page}));
import {enqueueConnectorSyncJob,processConnectorSyncJob} from '@/server/connectors/jobs';
import {dispatchConnectorNotifications} from '@/server/connectors/notifications';
const empty={events:[],evidence:[],batches:[],issues:[]};
beforeEach(()=>{const db=testDatabase();seedConnector(db.sqlite);state.db=db.d1;state.page.mockReset();state.send.mockReset().mockResolvedValue(undefined);});
it('coalesces concurrent jobs and refuses cross-tenant scope',async()=>{const input={tenantId:'t',connectionId:'c',requestedByUserId:'u',days:30};expect(new Set(await Promise.all(Array.from({length:8},()=>enqueueConnectorSyncJob(input)))).size).toBe(1);await expect(enqueueConnectorSyncJob({...input,tenantId:'foreign'})).rejects.toThrow('scope');});
it('commits page progress, resumes after timeout, and does not recount a duplicate delivery',async()=>{
 const id=await enqueueConnectorSyncJob({tenantId:'t',connectionId:'c',requestedByUserId:'u',days:30});
 state.page.mockResolvedValueOnce({data:empty,next:'page-2',stages:1}).mockRejectedValueOnce(Error('timeout')).mockImplementation(async(_credential,_connection,c)=>{expect(c.cursor).toBe('page-2');return {data:empty,next:'',stages:1};});
 await processConnectorSyncJob(id);await expect(processConnectorSyncJob(id)).rejects.toThrow('timeout');
 expect((await state.db!.prepare('SELECT checkpoint_json AS c FROM connector_sync_jobs').first<{c:string}>())?.c).toContain('page-2');
 await state.db!.prepare("UPDATE connector_sync_jobs SET next_attempt_at='2026-01-01'").run();await processConnectorSyncJob(id);await processConnectorSyncJob(id);
 expect(state.page).toHaveBeenCalledTimes(3);expect((await state.db!.prepare('SELECT COUNT(*) AS n FROM connector_page_receipts').first<{n:number}>())?.n).toBe(2);
});
it('a stale page cannot commit ledger/import/checkpoint or mark the connection healthy',async()=>{
 const id=await enqueueConnectorSyncJob({tenantId:'t',connectionId:'c',requestedByUserId:'u',days:30});
 state.page.mockImplementation(async()=>{await state.db!.prepare("UPDATE connector_sync_jobs SET lease_token='replacement'").run();return {data:empty,next:'',stages:1};});await processConnectorSyncJob(id);
 expect(await state.db!.prepare('SELECT id FROM data_imports').first()).toBeNull();expect(await state.db!.prepare('SELECT id FROM connector_page_receipts').first()).toBeNull();expect((await state.db!.prepare('SELECT status FROM connector_connections').first<{status:string}>())?.status).toBe('connected');
});
it('daily polling recovers missing notifications without creating duplicate active jobs',async()=>{await dispatchConnectorNotifications();await dispatchConnectorNotifications();expect((await state.db!.prepare('SELECT COUNT(*) AS n FROM connector_sync_jobs').first<{n:number}>())?.n).toBe(1);});
