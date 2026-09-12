import type { Metadata } from "next";
import { MarketplaceConnectionsWorkspace } from "@/components/marketplace-connections-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Marketplace Connections", robots: { index: false, follow: false } };

export default function ConnectionsPage() {
  return <MarketplaceConnectionsWorkspace />;
}
