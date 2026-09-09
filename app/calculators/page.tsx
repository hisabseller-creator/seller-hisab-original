import type { Metadata } from "next";
import { CalculatorHub } from "@/components/calculator-hub";

export const metadata: Metadata = {
  title: "Seller Calculators",
  description: "Free browser-local profit, RTO loss, break-even price, ACoS and ROAS calculators for Meesho sellers.",
  alternates: { canonical: "/calculators" },
};

export default function CalculatorsPage() {
  return <CalculatorHub />;
}

