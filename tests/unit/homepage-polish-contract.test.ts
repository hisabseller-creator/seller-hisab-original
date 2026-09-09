import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("homepage marketplace + tablet navigation polish", () => {
  it("uses the supplied marketplace SVG assets instead of hand-drawn inline logos", () => {
    const row = source("components/marketplace-brand-row.tsx");
    for (const asset of ["amazon.svg", "flipkart.svg", "meesho.svg", "shopify.svg", "woocommerce.svg"]) {
      expect(row).toContain(`/brands/marketplaces/${asset}`);
      expect(fs.existsSync(path.join(root, "public/brands/marketplaces", asset))).toBe(true);
    }
    expect(row).toContain("<img");
    expect(row).not.toContain("function AmazonLogo");
    expect(row).not.toContain("function WooCommerceLogo");
  });

  it("keeps every marketplace logo contained without text clipping", () => {
    const css = source("components/marketplace-responsive.css");
    const layout = source("app/layout.tsx");
    expect(layout).toContain('import "../components/marketplace-responsive.css"');
    expect(css).toContain("object-fit:contain");
    expect(css).toContain("marketplace-logo-meesho");
    expect(css).toContain("marketplace-logo-woocommerce");
    expect(css).toContain("overflow:visible");
  });

  it("makes tablet navigation read as equal clickable tabs", () => {
    const css = source("components/marketplace-responsive.css");
    expect(css).toContain("@media(min-width:601px) and (max-width:1024px)");
    expect(css).toContain("flex:1 1 0");
    expect(css).toContain("border:1px solid #e2e9f2");
    expect(css).toContain("a[aria-current]");
    expect(css).toContain("white-space:normal");
  });
});
