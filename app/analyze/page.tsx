import type { Metadata } from "next";
import { AnalyzeWizard } from "@/components/analyze-wizard";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Analyze Seller Profit Free",
  description: "Upload Payments to Date locally and calculate confirmed contribution, at-risk money and SKU actions without sharing raw files.",
  alternates: { canonical: "/analyze" },
};

export default function AnalyzePage() {
  return <PublicShell><AnalyzeWizard /></PublicShell>;
}
