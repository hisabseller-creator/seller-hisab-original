import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ask SellerHisab", robots: { index: false, follow: false } };

export default function AskSellerHisabPage() {
  return <AccountWorkspace view="ask" />;
}
