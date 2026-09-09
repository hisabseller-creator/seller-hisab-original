import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Privacy Policy & Data Processing",
  description: "How SellerHisab processes browser-local reports, normalized workspace data, connector credentials, billing records and account deletion.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <InfoPage
    eyebrow="Privacy by architecture"
    title="Raw analysis files stay local; optional workspace features store normalized data"
    intro="SellerHisab separates browser-local report analysis from features that you explicitly choose to save or connect. This page describes that distinction instead of claiming that every identifier always stays off the server."
    sections={[
      {
        title: "Normal Profit Check: browser-local raw files",
        bullets: [
          "Supported marketplace XLSX/CSV/ZIP parsing, normalization and primary finance calculations run in your browser/Web Worker.",
          "The raw normal-analysis file is not uploaded to SellerHisab account storage by that flow.",
          "Customer names, phone numbers and addresses are not required by SellerHisab's account-storage model and should not be uploaded to support.",
          "Browser-generated report exports are produced locally where the product says they are local.",
        ],
      },
      {
        title: "What can be stored when you explicitly use account/workspace features",
        bullets: [
          "Saved analysis summaries and reusable SKU costs when you choose to save/sync them.",
          "Normalized bank transaction fields used for Bank & Cash reconciliation; the raw bank file remains local to the browser.",
          "Normalized Ads and Inventory rows used for workspace analytics; their raw report files remain local to the browser.",
          "Normalized marketplace connector ledger records and sync metadata when you connect an official API.",
          "Encrypted marketplace API/OAuth credentials required to maintain an authorized read-only connection. SellerHisab does not request marketplace passwords.",
          "Workspace membership, roles, invitations, approval history and action audit records.",
        ],
      },
      {
        title: "Account and authentication data",
        bullets: [
          "Verified mobile number and/or email, optional profile name/city, registration/terms timestamps and authentication activity metadata.",
          "Sessions use secure HttpOnly SameSite cookies; raw session tokens are not returned in admin views.",
          "Passwords are stored only as password hashes. OTP values and marketplace passwords are not stored as reusable credentials.",
        ],
      },
      {
        title: "Payments and subscriptions",
        paragraphs: [
          "SellerHisab stores payment, refund/dispute, subscription and entitlement metadata needed to grant access, prevent duplicate fulfilment, reconcile provider events and handle support. The payment provider processes payment details under its own terms. SellerHisab does not send seller-report values or SKU rows in payment notes.",
          "Some payment, billing and fraud/dispute records may need to be retained after account deletion for tax, accounting, legal or chargeback obligations. Retained records should be pseudonymized where practical.",
        ],
      },
      {
        title: "Ask SellerHisab and benchmarks",
        bullets: [
          "Ask SellerHisab stores classified intent, evidence metadata and a one-way question hash; the free-form question text is not designed to be stored in the audit record.",
          "Seller data is not sent to a third-party generative-AI provider in the current governed Ask implementation.",
          "Benchmark contribution is OFF by default and only Owner/Admin roles can change participation.",
          "Cross-seller benchmark publication is currently gated off while comparable cohort definitions are validated. When enabled later, the minimum privacy cohort remains at least 20 opted-in businesses per comparable metric.",
        ],
      },
      {
        title: "Retention, export and deletion",
        bullets: [
          "Local browser data can be cleared from Settings at any time.",
          "Signed-in users can download a JSON account export from Settings. Connector secrets are intentionally excluded from exports.",
          "Account deletion removes sessions, saved analyses/costs, memberships and sole-owner workspace operational data, including stored connector credentials and normalized Bank/Ads/Inventory data.",
          "If an owner workspace still has other members, deletion is blocked until shared-workspace ownership/data impact is resolved.",
          "Operational, billing and security records have different retention needs; SellerHisab should retain only what is necessary for service, security, disputes and legal obligations.",
        ],
      },
      {
        title: "Support and security",
        paragraphs: [
          "Support requests are stored so the team can triage and resolve them. Never send passwords, OTPs, session cookies, marketplace secrets or full unredacted bank statements through support.",
          "Server inputs are validated and sensitive operations are rate-limited. Connector secrets are encrypted at rest and removed with the relevant deleted owner workspace or explicit disconnect flow.",
        ],
      },
    ]}
    note="Independent seller analytics utility. Not affiliated with or endorsed by Amazon, Flipkart, Meesho, Shopify, WooCommerce or any other marketplace/commerce platform. Legal/privacy wording should be reviewed by qualified Indian counsel before broad paid launch."
  />;
}
