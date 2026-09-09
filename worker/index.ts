/** SellerHisab Cloudflare Worker entry point and global HTTP security boundary. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { dispatchBillingOutbox, processBillingJob } from "@/server/billing-jobs";
import { processConnectorSyncJob } from "@/server/connectors/jobs";
import { processDueConnectorSyncJobs } from "@/server/connectors/jobs";
import { reconcileOpenSubscriptionsWithProvider, reconcileRecentBillingWithProvider } from "@/server/billing-reconciliation";
import { pruneOperationalRetention } from "@/server/retention";
import { dispatchConnectorNotifications } from '@/server/connectors/notifications';
import { reconcilePaymentIntents } from '@/server/payment-intent-recovery';
import { getSessionUser } from "@/server/auth";
import { hasAdminStepUp } from "@/server/admin-step-up";
import { enforceIpRateLimit, RateLimitError } from "@/server/rate-limit";
import { requestHasSameOrigin } from "@/server/admin";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BLOG_MEDIA: R2Bucket;
  APP_ENV?: string;
  RELEASE_ID?: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async queue(batch: MessageBatch<{kind: string; id: string}>): Promise<void> {
    for (const message of batch.messages) {
      try {
        if (message.body.kind === 'billing') await processBillingJob(message.body.id);
        else if (message.body.kind === 'connector') await processConnectorSyncJob(message.body.id);
        else throw new Error('Invalid queue message');
        message.ack();
      } catch { message.retry({delaySeconds:60}); }
    }
  },
  async scheduled(controller: ScheduledController, _env: Env, ctx: ExecutionContext): Promise<void> {
    if (controller.cron === "15 2 * * *") {
      ctx.waitUntil(Promise.all([
        reconcileRecentBillingWithProvider({ limit: 60 }),
        pruneOperationalRetention(),
      ]).then(() => undefined));
      return;
    }
    ctx.waitUntil(Promise.all([
      dispatchBillingOutbox(),
      processDueConnectorSyncJobs(),
      reconcilePaymentIntents(),
      dispatchConnectorNotifications(),
      reconcileOpenSubscriptionsWithProvider({ limit: 8 }),
    ]).then(() => undefined));
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    let response: Response;

    try {
      if (url.hostname.toLowerCase() === "www.sellerhisab.com") {
        const canonical = new URL(request.url);
        canonical.protocol = "https:";
        canonical.hostname = "sellerhisab.com";
        canonical.port = "";
        response = Response.redirect(canonical.toString(), 308);
      } else if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        if (!requestHasSameOrigin(request)) {
          response = Response.json({ error: "Cross-origin request rejected.", requestId }, { status: 403 });
        } else {
          response = await dispatchRequest(request, env, ctx, url);
        }
      } else {
        response = await dispatchRequest(request, env, ctx, url);
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: "request.error",
        requestId,
        method: request.method,
        path: url.pathname,
        errorType: error instanceof Error ? error.name : "UnknownError",
        release: env.CF_VERSION_METADATA?.id ?? env.RELEASE_ID ?? "local-unversioned",
      }));
      response = Response.json({ error: "Internal server error.", requestId }, { status: 500 });
    }

    const secured = withSecurityHeaders(response, request, requestId, env.CF_VERSION_METADATA?.id ?? env.RELEASE_ID ?? "local-unversioned");
    if (url.pathname.startsWith("/api/")) {
      console.log(JSON.stringify({
        event: "request.complete",
        requestId,
        method: request.method,
        path: url.pathname,
        status: secured.status,
        durationMs: Date.now() - startedAt,
        release: env.CF_VERSION_METADATA?.id ?? env.RELEASE_ID ?? "local-unversioned",
      }));
    }
    return secured;
  },
};


async function dispatchRequest(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  if (url.pathname === "/_vinext/image") {
    const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
    return handleImageOptimization(request, {
      fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
      transformImage: async (body, { width, format, quality }) => {
        const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
        return result.response();
      },
    }, allowedWidths);
  }
  if (['POST','PUT','PATCH','DELETE'].includes(request.method) && /^\/api\/(admin|account)\//.test(url.pathname)) {
    try { await enforceIpRateLimit(request,'private-mutation',120,60); }
    catch(error){if(error instanceof RateLimitError)return Response.json({error:error.message},{status:429,headers:{'retry-after':'60'}});throw error;}
    if(url.pathname.startsWith('/api/admin/')&&!['/api/admin/step-up','/api/admin/change-password'].includes(url.pathname)){
      const user=await getSessionUser(request);
      if(user&&!await hasAdminStepUp(request,user))return Response.json({error:'Reconfirm admin access, then retry this action.',code:'admin_step_up_required'},{status:401});
    }
  }
  const internalHeaders=new Headers(request.headers);
  internalHeaders.delete("x-sellerhisab-locale");
  const locale=/^\/(hi|en)\/blog\//.exec(url.pathname)?.[1];
  if(locale)internalHeaders.set("x-sellerhisab-locale",locale);
  return handler.fetch(new Request(request,{headers:internalHeaders}), env, ctx);
}

function isPrivateResponsePath(pathname: string): boolean {
  return ["/api/account/", "/api/admin/", "/api/auth/", "/api/billing/", "/api/payments/", "/api/entitlements/"].some((prefix) => pathname.startsWith(prefix));
}

function withSecurityHeaders(response: Response, request: Request, requestId: string, releaseId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("content-security-policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdnjs.cloudflare.com https://verify.msg91.com https://www.google.com https://www.gstatic.com https://js.hcaptcha.com https://*.hcaptcha.com https://www.recaptcha.net https://pass.hostdnssoft.com",
    "style-src 'self' 'unsafe-inline' https://*.hcaptcha.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.razorpay.com https://verify.msg91.com https://*.msg91.com https://www.google.com https://www.gstatic.com https://*.hcaptcha.com https://www.recaptcha.net https://pass.hostdnssoft.com",
    "frame-src 'self' https://*.razorpay.com https://verify.msg91.com https://www.google.com https://*.hcaptcha.com https://www.recaptcha.net https://pass.hostdnssoft.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(new URL(request.url).protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(new URL(request.url).hostname) ? [] : ["upgrade-insecure-requests"]),
  ].join("; "));
  headers.set("cross-origin-opener-policy", "same-origin-allow-popups");
  headers.set("cross-origin-resource-policy", "same-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("x-permitted-cross-domain-policies", "none");

  const pathname = new URL(request.url).pathname;
  const contentType = headers.get("content-type") ?? "";
  if (contentType.includes("text/html") || contentType.includes("application/json")) {
    const privatePath = pathname === "/app" || pathname.startsWith("/app/") ||
      pathname === "/admin" || pathname.startsWith("/admin/") ||
      pathname === "/api" || pathname.startsWith("/api/");
    headers.set(
      "x-robots-tag",
      privatePath ? "noindex, nofollow, noarchive" : "index, follow, max-image-preview:large",
    );
  }
  headers.set("x-request-id", requestId);
  headers.set("x-sellerhisab-release", releaseId);
  if (isPrivateResponsePath(new URL(request.url).pathname)) {
    headers.set("cache-control", "no-store, max-age=0");
    headers.set("pragma", "no-cache");
  }
  if (new URL(request.url).protocol === "https:") {
    headers.set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default worker;
