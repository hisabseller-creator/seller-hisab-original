import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Corrections Policy",
  description: "How SellerHisab handles corrections to public seller-finance content, calculation explanations and marketplace information.",
  alternates: { canonical: "/corrections-policy" },
};

export default function CorrectionsPolicyPage() {
  return <InfoPage
    eyebrow="Trust & publishing"
    title="SellerHisab Corrections Policy"
    intro="Financial guidance should be corrected when evidence changes or an error is found. SellerHisab distinguishes material corrections from ordinary copy edits."
    sections={[
      { title: "What triggers a correction", bullets: ["A formula or worked example is wrong.", "A marketplace policy, fee or report format has materially changed.", "A source was misread or no longer supports the claim.", "Product capability text overstates what SellerHisab actually supports."] },
      { title: "How we correct", paragraphs: ["We update the affected page, preserve a truthful updated date and, for a material change, add enough context for a reader to understand what changed. Search-engine freshness is not a reason to change dates."] },
      { title: "What is not a material correction", paragraphs: ["Spelling, formatting and accessibility improvements that do not change meaning can be fixed without a correction notice."] },
      { title: "Report an issue", paragraphs: ["Use the Contact page with the exact URL, the disputed statement and the source or example that shows the problem. Do not send marketplace passwords, OTPs, session cookies or unnecessary customer data."] },
    ]}
    note="SellerHisab does not guarantee marketplace, tax, legal or accounting outcomes. Corrections improve the public explanation; source data still controls any seller-specific analysis."
  />;
}
