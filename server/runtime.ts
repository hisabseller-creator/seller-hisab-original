import { env } from "cloudflare:workers";

// Server-only Cloudflare bindings used by the current SellerHisab runtime.
export type RuntimeEnv = {
  DB?: D1Database;
  BILLING_QUEUE?: Queue<{kind: "billing"; id: string}>;
  CONNECTOR_QUEUE?: Queue<{kind: "connector"; id: string}>;
  BILLING_DLQ?: Queue<{kind: "billing"; id: string}>;
  BLOG_MEDIA?: R2Bucket;
  APP_ENV?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  RAZORPAY_STARTER_PLAN_ID?: string;
  RAZORPAY_PRO_PLAN_ID?: string;
  ENTITLEMENT_SECRET?: string;
  SESSION_SECRET?: string;
  PRICE_ACTION_REPORT_PAISE?: string;
  PRICE_STARTER_PAISE?: string;
  PRICE_PRO_PAISE?: string;
  ADMIN_EMAILS?: string;
  ADMIN_PHONES?: string;
  MSG91_AUTH_KEY?: string;
  MSG91_WIDGET_ID?: string;
  MSG91_WIDGET_TOKEN?: string;
  AWS_S3_REGION?: string;
  AWS_S3_BUCKET?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  CONNECTOR_ENCRYPTION_KEY?: string;
  CONNECTOR_ENCRYPTION_KEY_V2?: string;
  BENCHMARK_PUBLICATION_ENABLED?: string;
  CONNECTOR_CALLBACK_ORIGIN?: string;
  SHOPIFY_CLIENT_ID?: string;
  SHOPIFY_CLIENT_SECRET?: string;
  SHOPIFY_SCOPES?: string;
  AMAZON_SPAPI_APPLICATION_ID?: string;
  AMAZON_LWA_CLIENT_ID?: string;
  AMAZON_LWA_CLIENT_SECRET?: string;
  AMAZON_SPAPI_DRAFT?: string;
  FLIPKART_CLIENT_ID?: string;
  FLIPKART_CLIENT_SECRET?: string;
  RELEASE_ID?: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
};

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function getD1(): D1Database {
  const database = runtimeEnv().DB;
  if (!database) throw new Error("D1 database binding is unavailable.");
  return database;
}

export function appEnvironment() {
  return runtimeEnv().APP_ENV ?? "local";
}
