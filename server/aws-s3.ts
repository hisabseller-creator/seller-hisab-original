import { runtimeEnv } from "./runtime";

type S3Method = "GET" | "PUT" | "DELETE";

type S3RequestOptions = {
  method: S3Method;
  key: string;
  body?: ArrayBuffer;
  contentType?: string;
};

const encoder = new TextEncoder();

export function blogMediaConfigured() {
  const env = runtimeEnv();
  return Boolean(
    env.AWS_S3_REGION?.trim() &&
    env.AWS_S3_BUCKET?.trim() &&
    env.AWS_ACCESS_KEY_ID?.trim() &&
    env.AWS_SECRET_ACCESS_KEY?.trim(),
  );
}

export async function putBlogMedia(key: string, body: ArrayBuffer, contentType: string) {
  const response = await signedS3Request({ method: "PUT", key, body, contentType });
  if (!response.ok) throw new Error(await providerError(response, "AWS S3 could not store the blog image."));
}

export async function getBlogMedia(key: string): Promise<Response> {
  return signedS3Request({ method: "GET", key });
}

export async function deleteBlogMedia(key: string | null | undefined) {
  if (!key || !blogMediaConfigured()) return;
  try {
    await signedS3Request({ method: "DELETE", key });
  } catch {
    // Media cleanup must never block a post update/delete.
  }
}

async function signedS3Request(options: S3RequestOptions): Promise<Response> {
  const env = runtimeEnv();
  const region = required(env.AWS_S3_REGION, "AWS_S3_REGION");
  const bucket = required(env.AWS_S3_BUCKET, "AWS_S3_BUCKET");
  const accessKeyId = required(env.AWS_ACCESS_KEY_ID, "AWS_ACCESS_KEY_ID");
  const secretAccessKey = required(env.AWS_SECRET_ACCESS_KEY, "AWS_SECRET_ACCESS_KEY");

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error("AWS S3 bucket name is invalid.");
  if (!/^[a-z0-9-]{3,32}$/.test(region)) throw new Error("AWS S3 region is invalid.");
  if (!/^[A-Za-z0-9._-]{1,220}$/.test(options.key)) throw new Error("Blog image key is invalid.");

  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const canonicalUri = `/${awsEncode(options.key)}`;
  const url = `https://${host}${canonicalUri}`;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(options.body ?? new ArrayBuffer(0));
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = `${options.method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256Hex(encoder.encode(canonicalRequest).buffer)}`;
  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region);
  const signature = toHex(new Uint8Array(await hmac(signingKey, stringToSign)));
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = new Headers({
    authorization,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  });
  if (options.contentType) headers.set("content-type", options.contentType);

  return fetch(url, {
    method: options.method,
    headers,
    body: options.method === "PUT" ? options.body : undefined,
  });
}

function required(value: string | undefined, name: string) {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} is not configured.`);
  return trimmed;
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function deriveSigningKey(secret: string, dateStamp: string, region: string): Promise<ArrayBuffer> {
  const kDate = await hmac(encoder.encode(`AWS4${secret}`).buffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

async function hmac(key: ArrayBuffer, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
}

async function sha256Hex(value: ArrayBuffer) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", value)));
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function providerError(response: Response, fallback: string) {
  try {
    const text = await response.text();
    const code = /<Code>([^<]+)<\/Code>/i.exec(text)?.[1];
    if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") return "AWS S3 credentials are invalid or do not match this bucket/region.";
    if (code === "AccessDenied") return "AWS S3 denied access. Check the IAM permissions for this bucket.";
    if (code === "NoSuchBucket") return "The configured AWS S3 bucket does not exist.";
  } catch {
    // Use the safe fallback below.
  }
  return fallback;
}
