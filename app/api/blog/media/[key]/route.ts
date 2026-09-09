import { getBlogMedia } from "@/server/blog-media";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> | { key: string } }) {
  const resolved = await Promise.resolve(params);
  const key = decodeURIComponent(resolved.key ?? "");
  if (!/^[A-Za-z0-9._-]{1,220}$/.test(key)) return new Response("Not found", { status: 404 });

  try {
    const upstream = await getBlogMedia(key);
    if (upstream.status === 404) return new Response("Not found", { status: 404 });
    if (!upstream.ok || !upstream.body) return new Response("Image unavailable", { status: 502 });

    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") ?? "application/octet-stream");
    headers.set("cache-control", "public, max-age=31536000, immutable");
    const etag = upstream.headers.get("etag");
    if (etag) headers.set("etag", etag);
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return new Response("Image unavailable", { status: 503 });
  }
}
