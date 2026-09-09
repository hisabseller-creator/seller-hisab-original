import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bank & Cash Truth", robots: { index: false, follow: false } };

export default function CashPage() {
  return <AccountWorkspace view="cash" />;
}
