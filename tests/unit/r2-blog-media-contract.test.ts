import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("R2 blog media contract", () => {
  it("binds SellerHisab production media bucket as BLOG_MEDIA", () => {
    const source = readFileSync("wrangler.jsonc", "utf8");
    expect(source).toContain('"bucket_name": "sellerhisab-media-prod"');
    expect(source).toContain('"binding": "BLOG_MEDIA"');
    expect(source).toContain('"remote": true');
    expect(source).not.toContain("sellr_hisab_blog_storage");
  });
  it("uses native R2 for blog media storage", () => {
    const source = readFileSync("server/blog-media.ts", "utf8");
    expect(source).toContain("runtimeEnv().BLOG_MEDIA");
    expect(source).toContain(".put(key, body");
    expect(source).toContain(".get(key)");
    expect(source).toContain(".delete(key)");
    expect(source).toContain("object.writeHttpMetadata(headers)");
    expect(source).toContain("object.httpEtag");
    expect(source).not.toContain('from "./aws-s3"');
  });
  it("keeps the public blog media URL contract unchanged", () => {
    const source = readFileSync(
      "core/blog-cms.ts",
      "utf8",
    );
    expect(source).toContain("/api/blog/media/");
  });
});
