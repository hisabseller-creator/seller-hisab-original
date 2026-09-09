export type SourceCoverage = {
 coverageStart:string;coverageEnd:string;ordersWindowBasis?:'created_at'|'updated_at';
 ordersComplete:boolean;financeComplete:boolean;payoutsComplete:boolean;
 rowCounts:{orders:number;finance:number;payouts:number};
 state:'partial'|'complete'|'failed';warnings:string[];checkpoint:string|null;
};
export function financeCoverageConfirmed(coverage:SourceCoverage|null|undefined):boolean {
 return Boolean(coverage&&coverage.state==='complete'&&coverage.ordersComplete&&coverage.financeComplete&&coverage.payoutsComplete&&!coverage.checkpoint&&!coverage.warnings.length);
}
export type PageCheckpoint={start:string;end:string;sliceStart:string;sliceEnd:string;stage:number;cursor:string;page:number;ordersComplete:boolean;financeComplete:boolean;payoutsComplete:boolean;warnings:string[];rowCounts:SourceCoverage['rowCounts'];done:boolean;orderDateField?:'updated_at';notBefore?:string};
export function initialCheckpoint(days:number,now=Date.now()):PageCheckpoint{
 const end=new Date(now-180000).toISOString(),start=new Date(Date.parse(end)-days*86400000).toISOString();
 return {start,end,sliceStart:start,sliceEnd:new Date(Math.min(Date.parse(end),Date.parse(start)+30*86400000)).toISOString(),stage:0,cursor:'',page:0,ordersComplete:true,financeComplete:true,payoutsComplete:true,warnings:[],rowCounts:{orders:0,finance:0,payouts:0},done:false};
}
export function coverageFor(c:PageCheckpoint):SourceCoverage{
 return {coverageStart:c.start,coverageEnd:c.end,ordersWindowBasis:c.orderDateField??'created_at',ordersComplete:c.done&&c.ordersComplete,financeComplete:c.done&&c.financeComplete,payoutsComplete:c.done&&c.payoutsComplete,rowCounts:c.rowCounts,state:c.done&&c.ordersComplete&&c.financeComplete&&c.payoutsComplete&&!c.warnings.length?'complete':'partial',warnings:c.warnings,checkpoint:c.done?null:JSON.stringify({slice:c.sliceStart,stage:c.stage,page:c.page})};
}
