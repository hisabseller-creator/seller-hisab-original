import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("footer reference redesign", () => {
  it("uses the approved dark footer structure and keeps dynamic SellerHisab data", () => {
    const footer = source("components/site-footer.tsx");
    expect(footer).toContain("footer-reference-shell");
    expect(footer).toContain("Stay Updated");
    expect(footer).toContain("Built for");
    expect(footer).toContain("SocialBrandIcon");
    expect(footer).toContain("settings.contact");
    expect(footer).toContain("setLanguage");
    expect(footer).toContain("footer-brand-card");
  });

  it("keeps the reference footer visually distinct and responsive", () => {
    const css = source("components/website.css");
    expect(css).toContain("Footer reference match");
    expect(css).toContain(".footer-reference-shell");
    expect(css).toContain("linear-gradient(132deg,#071d39");
    expect(css).toContain(".footer-reference-updates");
    expect(css).toContain("@media(max-width:560px)");
  });
});
