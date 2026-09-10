import type { SiteSettings } from "./site-settings";

export type FeatureTabId = "profit" | "calculators" | "blog" | "pricing" | "account" | "help";
export type FeatureTab = { id: FeatureTabId; href: string };

export function buildFeatureTabs(input: {
  loggedIn: boolean;
  hasPaidAccess: boolean;
  navigation: SiteSettings["navigation"];
}): FeatureTab[] {
  const tabs: FeatureTab[] = [{ id: "profit", href: "/analyze" }];
  if (input.navigation.showCalculators) tabs.push({ id: "calculators", href: "/calculators" });
  tabs.push({ id: "blog", href: "/blog" });
  if (input.navigation.showPricing) tabs.push({ id: "pricing", href: "/pricing" });
  tabs.push({ id: "account", href: "/app" });
  return tabs;
}
