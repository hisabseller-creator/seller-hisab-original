import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Marketplace Connections", robots: { index: false, follow: false } };

export default function ConnectionsPage() {
  return <AccountWorkspace view="connections" />;
}
