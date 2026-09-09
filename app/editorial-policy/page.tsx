import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Editorial Policy",
  description: "SellerHisab editorial standards for seller-finance guides, marketplace updates, calculations, sources, review dates and corrections.",
  alternates: { canonical: "/editorial-policy" },
};

export default function EditorialPolicyPage() {
  return <InfoPage
    eyebrow="Trust & publishing"
    title="SellerHisab Editorial Policy"
    intro="SellerHisab publishes seller-finance content to help users understand evidence, calculations and operational decisions. Search traffic never overrides financial accuracy."
    sections={[
      { title: "Source hierarchy", bullets: ["Marketplace-specific policy or fee claims should use official marketplace documentation where available.", "Tax or regulatory claims should use the relevant government or primary source.", "SellerHisab product-methodology claims must match the actual implemented calculation logic.", "Third-party commentary is supplementary, not a substitute for primary evidence."] },
      { title: "No invented freshness", paragraphs: ["Published, reviewed and updated dates reflect real editorial work. Dates are not changed merely to make an unchanged article look fresh."] },
      { title: "Answer-first, evidence-next", paragraphs: ["Important guides should give a concise direct answer, then explain the formula, example, assumptions, edge cases and supporting evidence."] },
      { title: "Financial caution", bullets: ["Contribution is not labelled Net Profit when fixed overhead, taxes or other required evidence are missing.", "Unknown report schemas fail closed instead of mapping money columns by guesswork.", "Marketplace fees and policies can change; time-sensitive articles should show their review date and source context."] },
      { title: "Authorship", paragraphs: ["Core product and seller-finance explainers are published under the SellerHisab Research Team profile unless a named specialist author or reviewer is explicitly shown."] },
    ]}
    note="If you find a factual or calculation issue, use the Contact page and reference the affected URL. Material corrections follow the Corrections Policy."
  />;
}
