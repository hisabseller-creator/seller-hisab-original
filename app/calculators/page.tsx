import type { Metadata } from "next";
import { CalculatorHub } from "@/components/calculator-hub";

export const metadata: Metadata = {
  title: "Marketplace Seller Calculators",
  description: "Free browser-local profit, return/RTO loss, break-even price, ACoS and ROAS calculators for Meesho, Amazon India, Flipkart, Shopify and WooCommerce sellers.",
  alternates: { canonical: "/calculators" },
};

export default function CalculatorsPage() {
  return <CalculatorHub />;
}
