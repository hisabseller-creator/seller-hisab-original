export class ProviderTransportError extends Error {
  constructor(public code: string, public status=503, public retryAfterMs=0) { super("Provider is temporarily unavailable. The operation remains recoverable."); }
}
export function retryAfterMs(value: string | null, now=Date.now()): number {
  if (!value) return 0;
  const seconds=Number(value);
  const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
  return Number.isFinite(delay)?Math.max(0,delay):0;
}
export async function providerFetch(url: string | URL, init: RequestInit={}, policy: { safeRead?: boolean; timeoutMs?: number; attempts?: number }={}): Promise<Response> {
  const safe=policy.safeRead ?? ['GET','HEAD'].includes((init.method??'GET').toUpperCase());
  const attempts=safe?Math.min(3,Math.max(1,policy.attempts??3)):1;
  for(let attempt=0;attempt<attempts;attempt++){
    try {
      const response=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.any([AbortSignal.timeout(policy.timeoutMs??8000),...(init.signal?[init.signal]:[])])});
      if(response.status!==429&&response.status<500)return response;
      const delay=Math.max(retryAfterMs(response.headers.get('retry-after')),Math.min(2000,250*2**attempt)+Math.floor(Math.random()*250));
      if(!safe)return response;
      await response.body?.cancel();
      if(attempt===attempts-1)throw new ProviderTransportError('provider_retry_exhausted',response.status,delay);
      // Long provider delays belong in durable state, never a blocked request.
      if(delay>3000)throw new ProviderTransportError('provider_throttled',response.status,delay);
      await new Promise(resolve=>setTimeout(resolve,delay));
    } catch(error) {
      if(error instanceof ProviderTransportError)throw error;
      if(init.signal?.aborted || attempt===attempts-1)throw new ProviderTransportError('provider_timeout_or_network');
      await new Promise(resolve=>setTimeout(resolve,250*2**attempt+Math.floor(Math.random()*250)));
    }
  }
  throw new ProviderTransportError('provider_retry_exhausted');
}
