import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Website Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminPanel />;
}

