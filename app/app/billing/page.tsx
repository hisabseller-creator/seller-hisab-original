import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing", robots: { index: false, follow: false } };
export default function BillingPage() { return <AccountWorkspace view="billing" />; }
