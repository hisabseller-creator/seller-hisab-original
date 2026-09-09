import { runtimeEnv } from "./runtime";
const BLOG_MEDIA_KEY = /^[A-Za-z0-9._-]{1,220}$/;
function assertBlogMediaKey(key: string) {
  if (!BLOG_MEDIA_KEY.test(key)) {
    throw new Error("Blog image key is invalid.");
  }
}
function getBlogMediaBucket(): R2Bucket {
  const bucket = runtimeEnv().BLOG_MEDIA;
  if (!bucket) {
    throw new Error("Blog media R2 binding is unavailable.");
  }
  return bucket;
}
export function blogMediaConfigured() {
  return Boolean(runtimeEnv().BLOG_MEDIA);
}
export async function putBlogMedia(
  key: string,
  body: ArrayBuffer,
  contentType: string,
) {
  assertBlogMediaKey(key);
  const stored = await getBlogMediaBucket().put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      purpose: "sellerhisab-blog-media",
    },
  }).catch(()=>{console.error(JSON.stringify({event:'r2.media.failure',operation:'put'}));throw Error('Media storage unavailable.');});
  if (!stored) {
    throw new Error("R2 could not store the blog image.");
  }
}
export async function getBlogMedia(key: string): Promise<Response> {
  assertBlogMediaKey(key);
  const object = await getBlogMediaBucket().get(key).catch(()=>{console.error(JSON.stringify({event:'r2.media.failure',operation:'get'}));throw Error('Media storage unavailable.');});
  if (!object) {
    return new Response(null, { status: 404 });
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, {
    status: 200,
    headers,
  });
}
export async function deleteBlogMedia(
  key: string | null | undefined,
) {
  const bucket = runtimeEnv().BLOG_MEDIA;
  if (!key || !bucket) return;
  try {
    assertBlogMediaKey(key);
    await bucket.delete(key);
  } catch {
    console.error(JSON.stringify({event:'r2.media.failure',operation:'delete'}));
    // Media cleanup must never block a post update/delete.
  }
}
