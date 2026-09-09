import type { Metadata } from "next";
import { PricingView } from "@/components/pricing-view";
import { getPricing } from "@/server/pricing";
import { getTrialOffers } from "@/server/trials";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free seller profit check, ₹49 Action Report, ₹99 Starter and ₹199 Pro plans.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const [pricing, trials] = await Promise.all([getPricing(), getTrialOffers()]);
  return <PricingView actionReportPaise={pricing.actionReportPaise} starterMonthlyPaise={pricing.starterMonthlyPaise} proMonthlyPaise={pricing.proMonthlyPaise} trials={trials} />;
}
