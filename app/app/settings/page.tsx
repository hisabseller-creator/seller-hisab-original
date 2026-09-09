import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Privacy Settings", robots: { index: false, follow: false } };
export default function SettingsPage() { return <AccountWorkspace view="settings" />; }
