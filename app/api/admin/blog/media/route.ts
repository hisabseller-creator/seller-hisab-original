import { getSessionUser } from "@/server/auth";
import { isAdminUser, requestHasSameOrigin } from "@/server/admin";
import { putBlogMedia } from "@/server/blog-media";
import { blogImageUrl, slugifyBlogTitle } from "@/core/blog-cms";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

type ImageKind = { mime: string; extension: string; width: number; height: number };

export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isAdminUser(user.email, user.phone)) return Response.json({ error: "Admin access is not enabled for this account." }, { status: 403 });
  if (!requestHasSameOrigin(request)) return Response.json({ error: "Cross-origin upload blocked." }, { status: 403 });

  try {
    await enforceRateLimit(request, "admin-blog-media", user.id, 30, 60 * 60);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose an image first." }, { status: 400 });
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) return Response.json({ error: "Image must be under 5 MB." }, { status: 400 });

    const body = await file.arrayBuffer();
    const kind = detectImage(body);
    if (!kind) return Response.json({ error: "Use a valid JPG, PNG, WebP or GIF image with readable dimensions." }, { status: 400 });
    if (kind.width < 1200) return Response.json({ error: `Blog hero image must be at least 1200 px wide. Selected image is ${kind.width} px.` }, { status: 400 });
    const ratio = kind.width / kind.height;
    if (ratio < 1.6 || ratio > 1.9) {
      return Response.json({ error: `Use a landscape hero image close to 16:9. Selected ratio is ${ratio.toFixed(2)}:1.` }, { status: 400 });
    }

    const titleHint = String(formData.get("title") ?? "article-image").trim();
    const readable = slugifyBlogTitle(titleHint).slice(0, 48);
    const key = `blog_${readable}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}.${kind.extension}`;
    await putBlogMedia(key, body, kind.mime);
    return Response.json({ imageKey: key, imageUrl: blogImageUrl(key), width: kind.width, height: kind.height });
  } catch (error) {
    if (error instanceof RateLimitError) return Response.json({ error: error.message }, { status: 429 });
    return Response.json({ error: error instanceof Error ? error.message : "Image upload failed." }, { status: 503 });
  }
}

function detectImage(buffer: ArrayBuffer): ImageKind | null {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(buffer);
    return {
      mime: "image/png",
      extension: "png",
      width: view.getUint32(16),
      height: view.getUint32(20),
    };
  }

  if (bytes.length >= 10 && (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")) {
    const view = new DataView(buffer);
    return {
      mime: "image/gif",
      extension: "gif",
      width: view.getUint16(6, true),
      height: view.getUint16(8, true),
    };
  }

  if (bytes.length >= 30 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    const chunk = ascii(bytes, 12, 16);
    if (chunk === "VP8X") {
      return {
        mime: "image/webp",
        extension: "webp",
        width: 1 + readUint24LE(bytes, 24),
        height: 1 + readUint24LE(bytes, 27),
      };
    }
    if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return {
        mime: "image/webp",
        extension: "webp",
        width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
        height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const b1 = bytes[21];
      const b2 = bytes[22];
      const b3 = bytes[23];
      const b4 = bytes[24];
      return {
        mime: "image/webp",
        extension: "webp",
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      };
    }
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const dimensions = jpegDimensions(bytes);
    if (dimensions) {
      return {
        mime: "image/jpeg",
        extension: "jpg",
        width: dimensions.width,
        height: dimensions.height,
      };
    }
  }

  return null;
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    const sof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (sof && length >= 7) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}
