import { describe, expect, it } from "vitest";
import { calculateBlogReadTime, sanitizeBlogHtml, slugifyBlogTitle } from "@/core/blog-cms";

describe("blog CMS helpers", () => {
  it("creates stable readable slugs", () => {
    expect(slugifyBlogTitle("RTO vs Returns: What changes? ")).toBe("rto-vs-returns-what-changes");
  });

  it("removes active and embedded content from admin HTML", () => {
    const output = sanitizeBlogHtml('<h2>Hello</h2><script>alert(1)</script><p onclick="bad()">Safe</p><img src="x">');
    expect(output).toContain("<h2>Hello</h2>");
    expect(output).toContain("<p>Safe</p>");
    expect(output).not.toContain("script");
    expect(output).not.toContain("onclick");
    expect(output).not.toContain("<img");
  });

  it("calculates read time from visible words", () => {
    const html = `<p>${Array.from({ length: 401 }, () => "word").join(" ")}</p>`;
    expect(calculateBlogReadTime(html)).toBe("3 min read");
  });
});
