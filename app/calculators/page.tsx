import type { Metadata } from "next";
import { CalculatorHub } from "@/components/calculator-hub";

export const metadata: Metadata = {
  title: "5 Universal Seller Calculators",
  description: "Five marketplace-neutral calculators for seller profit, return/RTO loss, break-even price, Max ACoS and break-even ROAS using your own evidence.",
  alternates: { canonical: "/calculators" },
};

export default function CalculatorsPage() {
  return <CalculatorHub />;
}
