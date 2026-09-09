import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Help & Supported Reports",
  description: "How to download and safely analyze Meesho, Amazon India, Flipkart and Shopify seller reports.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return <InfoPage
    eyebrow="Help center"
    title="Where to find reports and how to prepare them"
    intro="SellerHisab calculates from marketplace financial evidence, not sales totals. For Amazon, Flipkart and Shopify, add the supported Orders file plus the matching settlement/payment file."
    sections={[
      {
        title: "Meesho",
        paragraphs: ["Open the Meesho Supplier Panel Payments section and export the available Payments or Payments to Date report. Orders and Ads files can be added for better matching and action quality."],
        bullets: ["Payments/Payments to Date: XLSX or CSV.", "Stable Sub-Order Number + Supplier SKU + settlement amount are required.", "Orders-only is not enough for confirmed contribution."],
      },
      {
        title: "Amazon India",
        paragraphs: ["Use the Amazon Orders export together with Payments → All Statements → Settlement Flat File V2. SellerHisab supports the tab-delimited Flat File V2 directly, so you do not need to convert it to Excel."],
        bullets: ["Orders report: amazon-order-id + SKU + quantity-purchased + item-price.", "Payments: Settlement Flat File V2 with settlement-id, order-id, amount-type and amount.", "SP-API connection is optional; file analysis does not require your Seller Central password or API token."],
      },
      {
        title: "Flipkart",
        paragraphs: ["Use an Orders report plus the seller settlement/P&L export. SellerHisab links line-level money only when a stable Order Item ID + SKU is available, or uses explicit Order ID evidence when the settlement is order-level."],
        bullets: ["Orders: Order Item ID, seller SKU, status, quantity and selling price.", "Settlement/P&L: Order Item ID + SKU + settlement amount, or Order ID + settlement amount.", "Seller/Reports API auto-sync is separate from local file analysis and requires Flipkart authorization/partner access."],
      },
      {
        title: "Shopify",
        paragraphs: ["Export Orders CSV from Shopify Admin and export Shopify Payments balance transactions from Finance/Payments → Payouts → View transactions → Export."],
        bullets: ["Orders CSV: Name, Financial Status, Lineitem SKU, Lineitem quantity and Lineitem price.", "Shopify Payments CSV: Transaction Date, Type, Order, Payout Status, Amount, Fee and Net.", "SellerHisab uses Net as financial evidence and allocates order-level Net across known order lines by observed line sales."],
      },
      {
        title: "Cost sheet format",
        bullets: ["Required columns: SKU and Product Cost.", "Optional: Packaging Cost and Other Variable Cost.", "Use one SKU per row; duplicate SKU rows are rejected.", "Enter amounts in rupees; negative costs are rejected."],
      },
      {
        title: "Supported files and safety",
        bullets: ["XLSX, XLS, CSV, TSV, TXT and supported ZIP.", "50 MB per file.", "ZIP max 20 files, no nested ZIP, safe compression ratio and path checks.", "Unknown or changed critical schemas fail closed instead of guessing financial columns."],
      },
      {
        title: "Common errors",
        bullets: ["Orders report only: add the matching settlement/payment report.", "Missing SKU cost: add cost before trusting contribution.", "New report format: SellerHisab cannot safely map the required columns.", "Duplicate file: ignored to prevent double counting.", "Pending payout evidence remains provisional instead of being called received cash."],
      },
      {
        title: "Privacy",
        paragraphs: ["Raw marketplace report content stays inside your browser in this analysis flow. Do not share marketplace passwords, OTPs or session cookies with SellerHisab."],
      },
    ]}
    note="Need help? Use the Contact page. Do not share marketplace passwords, OTPs or session cookies."
  />;
}
