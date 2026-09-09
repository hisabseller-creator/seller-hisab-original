import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
export const metadata: Metadata = { title: "Refund Policy", description: "Refund terms for one-time Action Reports and subscriptions.", alternates: { canonical: "/refund-policy" } };
export default function RefundPage() { return <InfoPage eyebrow="Refund policy" title="Pay only after seeing the free headline result" intro="The free check shows real value first. The paid unlock is for full action depth, simulators and exports." sections={[
  { title: "One-time Action Report", paragraphs: ["If payment is captured but the current analysis does not unlock because of a verified technical failure, contact support within 7 days with payment ID and analysis reference. We will restore access or refund the ₹49 payment after verification."] },
  { title: "Subscriptions", paragraphs: ["Cancel before the next renewal to stop future charges. A billing period already started is generally non-refundable once full report/history features are used, except duplicate charge, unauthorized payment or verified service failure required by law."] },
  { title: "Not eligible", bullets: ["A business decision did not produce the hoped-for outcome.", "Inputs were inaccurate, incomplete or covered the wrong period.", "Refund abuse, chargeback fraud or material violation of the Terms."] },
  { title: "Refund processing", paragraphs: ["Approved refunds are initiated through the original payment method. Bank or provider posting time is outside our control. Refunded one-time entitlements are revoked after the signed provider event is processed."] },
]} note="Contact support with payment ID only—never email a raw seller report unless a separate secure support process explicitly asks and you consent." />; }
