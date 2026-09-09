"use client";

import Link from "next/link";
import { BadgeIndianRupee, BookOpenCheck, Calculator, CircleUserRound, Newspaper, ScanLine } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
import { buildFeatureTabs, type FeatureTabId } from "@/core/navigation";
import { useAccountStatus, useLanguage, useSiteSettings } from "./providers";

const icons = {
  profit: ScanLine,
  calculators: Calculator,
  blog: Newspaper,
  pricing: BadgeIndianRupee,
  account: CircleUserRound,
  help: BookOpenCheck,
} satisfies Record<FeatureTabId, typeof ScanLine>;

export function FeatureTabs() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { user, hasPaidAccess, refresh } = useAccountStatus();
  const { settings } = useSiteSettings();
  const english = language === "english";
  const tabs = buildFeatureTabs({ loggedIn: Boolean(user), hasPaidAccess, navigation: settings.navigation });
  const labels: Record<FeatureTabId, string> = {
    profit: "Profit Check",
    calculators: "Calculators",
    blog: english ? "Blog" : "Blog",
    pricing: "Pricing",
    account: user ? (english ? "My Account" : "मेरा Account") : "Login / Register",
    help: english ? "How to Use" : "कैसे use करें",
  };
  const style = { "--feature-count": tabs.length } as CSSProperties;

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, refresh]);

  return (
    <nav className="px-2.5 pt-2.5 sm:px-5 sm:pt-3" aria-label="SellerHisab features">
      <div className="glass-nav mx-auto max-w-[1380px] rounded-[22px] p-2 sm:p-2.5">
        <div className="feature-tabs-grid" style={style}>
          {tabs.map((tab) => {
            const Icon = icons[tab.id];
            const active = isActiveFeature(pathname, tab.id, tab.href);
            const href = tab.id === "account" && !user
              ? `/app?returnTo=${encodeURIComponent(pathname || "/")}`
              : tab.href;
            return (
              <Link key={tab.id} href={href} aria-current={active ? "page" : undefined} className={`feature-tab ${active ? "feature-tab-active" : ""}`}>
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{labels[tab.id]}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function isActiveFeature(pathname: string, id: FeatureTabId, href: string) {
  if (id === "calculators") return pathname === "/calculators" || pathname.startsWith("/meesho-");
  if (id === "blog") return pathname === "/blog" || pathname.startsWith("/blog/");
  if (id === "account") return pathname === "/app" || pathname.startsWith("/app/");
  return pathname === href;
}
