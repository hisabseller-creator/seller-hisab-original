import { describe, expect, it } from "vitest";
import fs from "node:fs";
const read = (path: string) => fs.readFileSync(path, "utf8");
describe("F14 bilingual blog contract", () => {
  it("persists a separate English article body", () => {
    expect(read("db/schema.ts")).toContain('htmlContentEn: text("html_content_en")');
    expect(read("drizzle/0018_bilingual_blog.sql")).toContain("ADD COLUMN html_content_en");
    expect(read("server/blog.ts")).toContain("html_content_en AS htmlContentEn");
    expect(read("server/blog.ts")).toContain("sanitizeBlogHtml(input.htmlContentEn");
  });
  it("keeps strict API validation with at least one article language", () => {
    const api = read("app/api/admin/blog/route.ts");
    expect(api).toContain("htmlContentEn");
    expect(api).toContain(".strict().superRefine");
    expect(api).toContain("!value.htmlContent.trim() && !value.htmlContentEn.trim()");
  });
  it("provides bilingual editor and public language switch", () => {
    const editor = read("components/admin-blog-manager.tsx");
    const localized = read("components/blog-localized-content.tsx");
    expect(editor).toContain("Hindi Article HTML");
    expect(editor).toContain("English Article HTML");
    expect(localized).toContain("const bilingual = hasHindi && hasEnglish");
    expect(localized).toContain("हिंदी");
    expect(localized).toContain("English");
  });
  it("keeps the hero image clean and shows SellerHisab branding for research team", () => {
    const article = read("components/blog-article.tsx");
    expect(article).toContain('src="/sellerhisab-mark.svg"');
    expect(article).toContain('post.authorName === "SellerHisab Research Team"');
    expect(article).toContain("<BlogLocalizedContent");
    expect(article).not.toContain("bg-gradient-to-t from-slate-950/90");
  });
});
