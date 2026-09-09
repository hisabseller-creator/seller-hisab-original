import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analysis History", robots: { index: false, follow: false } };
export default function HistoryPage() { return <AccountWorkspace view="history" />; }
