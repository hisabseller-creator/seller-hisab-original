import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory & Reorder Intelligence", robots: { index: false, follow: false } };

export default function InventoryPage() {
  return <AccountWorkspace view="inventory" />;
}
