import { describe, expect, it } from "vitest";
import { sanitizeBlogHtml } from "@/core/blog-cms";

describe("blog HTML sanitizer", () => {
  it("drops active and embedded content", () => {
    const result = sanitizeBlogHtml(`<p>Hello</p><script>alert(1)</script><svg><a onload=alert(1)>x</a></svg><iframe src="https://evil.example"></iframe>`);
    expect(result).toContain("<p>Hello</p>");
    expect(result).not.toMatch(/script|svg|iframe|onload/i);
  });

  it("keeps only safe link schemes and strips event/style attributes", () => {
    const result = sanitizeBlogHtml(`<a href="javascript:alert(1)" onclick="alert(2)" style="color:red">bad</a><a href="https://sellerhisab.com/help" target="_blank">good</a>`);
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("style=");
    expect(result).toContain('href="https://sellerhisab.com/help"');
    expect(result).toContain('rel="nofollow noopener noreferrer"');
  });

  it("rejects encoded javascript schemes and protocol-relative links", () => {
    const result = sanitizeBlogHtml(`<a href="&#106;avascript:alert(1)">one</a><a href="//evil.example">two</a><a href="/help">three</a>`);
    expect(result).not.toContain("&#106;avascript");
    expect(result).not.toContain("//evil.example");
    expect(result).toContain('href="/help"');
  });
});
