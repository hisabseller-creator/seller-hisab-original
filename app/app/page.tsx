import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account Overview", robots: { index: false, follow: false } };
export default function AppPage() { return <AccountWorkspace view="overview" />; }
