import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved SKU Costs", robots: { index: false, follow: false } };
export default function CostsPage() { return <AccountWorkspace view="costs" />; }
