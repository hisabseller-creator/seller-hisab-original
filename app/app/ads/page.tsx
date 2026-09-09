import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ads & Marketing Economics", robots: { index: false, follow: false } };

export default function AdsPage() {
  return <AccountWorkspace view="ads" />;
}
