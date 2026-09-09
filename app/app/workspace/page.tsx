import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Professional Workspace", robots: { index: false, follow: false } };

export default function WorkspacePage() {
  return <AccountWorkspace view="workspace" />;
}
