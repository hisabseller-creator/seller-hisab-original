export type MarketplaceExperienceId = "meesho" | "amazon" | "flipkart" | "shopify" | "woocommerce";
export type CapabilityState = "live" | "available" | "activation-required" | "not-available";

export type MarketplaceCapability = {
  state: CapabilityState;
  label: string;
  detail: string;
  href?: string;
};

export type MarketplaceDefinition = {
  id: MarketplaceExperienceId;
  name: string;
  channelId: string;
  logo: string;
  hubHref: string;
  summary: string;
  fileAnalysis: MarketplaceCapability;
  connection: MarketplaceCapability;
  guides: MarketplaceCapability;
  calculators: MarketplaceCapability;
  guideSlug: string;
  calculatorSlugs: readonly string[];
  primaryCta: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
};

export const MARKETPLACE_DEFINITIONS: Record<MarketplaceExperienceId, MarketplaceDefinition> = {
  meesho: {
    id: "meesho",
    name: "Meesho",
    channelId: "meesho",
    logo: "/brands/marketplaces/meesho.svg",
    hubHref: "/marketplaces/meesho",
    summary: "File-first profit, settlement, return/RTO and SKU analysis for Meesho sellers.",
    fileAnalysis: {
      state: "live",
      label: "File analysis live",
      detail: "Payments/Payments to Date plus supported Orders and Ads evidence can be analyzed without a marketplace login.",
      href: "/analyze",
    },
    connection: {
      state: "not-available",
      label: "File-first only",
      detail: "SellerHisab does not claim a general public Meesho seller API connection.",
    },
    guides: {
      state: "live",
      label: "Guides available",
      detail: "Marketplace-specific profitability, settlement and RTO guidance is available.",
      href: "/guides/meesho-profitability",
    },
    calculators: {
      state: "live",
      label: "Calculators available",
      detail: "Profit, RTO loss, break-even, ACoS and ROAS calculators are available.",
      href: "/meesho-profit-calculator",
    },
    guideSlug: "meesho-profitability",
    calculatorSlugs: [
      "meesho-profit-calculator",
      "meesho-rto-calculator",
      "meesho-break-even-price",
      "meesho-acos-calculator",
      "meesho-ads-break-even-roas",
    ],
    primaryCta: { href: "/analyze", label: "Analyze Meesho files" },
    secondaryCta: { href: "/marketplaces/meesho", label: "Open Meesho hub" },
  },
  amazon: {
    id: "amazon",
    name: "Amazon India",
    channelId: "amazon-in",
    logo: "/brands/marketplaces/amazon.svg",
    hubHref: "/marketplaces/amazon",
    summary: "Orders + settlement file analysis for Amazon India sellers.",
    fileAnalysis: {
      state: "live",
      label: "File analysis live",
      detail: "Supported Orders export and Settlement Flat File V2 evidence can be analyzed without API access.",
      href: "/analyze",
    },
    connection: {
      state: "not-available",
      label: "API connection not active",
      detail: "Use supported Amazon files for analysis while the public API connection remains unavailable.",
    },
    guides: {
      state: "live",
      label: "Guides available",
      detail: "Amazon-specific order, settlement and profitability guidance is available.",
      href: "/guides/amazon-india-profitability",
    },
    calculators: {
      state: "live",
      label: "Calculators available",
      detail: "Amazon profit, return loss, break-even, ACoS and ROAS calculators are available.",
      href: "/amazon-profit-calculator",
    },
    guideSlug: "amazon-india-profitability",
    calculatorSlugs: [
      "amazon-profit-calculator",
      "amazon-return-loss-calculator",
      "amazon-break-even-price",
      "amazon-acos-calculator",
      "amazon-ads-break-even-roas",
    ],
    primaryCta: { href: "/analyze", label: "Analyze Amazon files" },
  },
  flipkart: {
    id: "flipkart",
    name: "Flipkart",
    channelId: "flipkart",
    logo: "/brands/marketplaces/flipkart.svg",
    hubHref: "/marketplaces/flipkart",
    summary: "Order + settlement/P&L file analysis with optional seller-authorized order sync.",
    fileAnalysis: {
      state: "live",
      label: "File analysis live",
      detail: "Supported Orders and settlement/P&L files can be analyzed with deterministic order linkage.",
      href: "/analyze",
    },
    connection: {
      state: "activation-required",
      label: "Official connection supported",
      detail: "Seller API order sync is implemented after app configuration and seller authorization; settlement remains validated-file-first.",
      href: "/app/connections",
    },
    guides: {
      state: "live",
      label: "Guides available",
      detail: "Flipkart-specific profitability, settlement and return/RTO guidance is available.",
      href: "/guides/flipkart-profitability",
    },
    calculators: {
      state: "live",
      label: "Calculators available",
      detail: "Flipkart profit, RTO/return loss, break-even, ACoS and ROAS calculators are available.",
      href: "/flipkart-profit-calculator",
    },
    guideSlug: "flipkart-profitability",
    calculatorSlugs: [
      "flipkart-profit-calculator",
      "flipkart-rto-calculator",
      "flipkart-break-even-price",
      "flipkart-acos-calculator",
      "flipkart-ads-break-even-roas",
    ],
    primaryCta: { href: "/analyze", label: "Analyze Flipkart files" },
    secondaryCta: { href: "/app/connections", label: "Open Connections" },
  },
  shopify: {
    id: "shopify",
    name: "Shopify",
    channelId: "shopify",
    logo: "/brands/marketplaces/shopify.svg",
    hubHref: "/marketplaces/shopify",
    summary: "Orders + Shopify Payments file analysis with optional merchant-authorized Admin API read sync.",
    fileAnalysis: {
      state: "live",
      label: "File analysis live",
      detail: "Orders CSV and supported Shopify Payments balance-transactions evidence can be analyzed without OAuth.",
      href: "/analyze",
    },
    connection: {
      state: "activation-required",
      label: "Official connection supported",
      detail: "Admin GraphQL read sync is implemented after SellerHisab app configuration and merchant authorization; payment evidence depends on granted scopes.",
      href: "/app/connections",
    },
    guides: {
      state: "live",
      label: "Guides available",
      detail: "Shopify-specific order, payout, refund and profitability guidance is available.",
      href: "/guides/shopify-profitability",
    },
    calculators: {
      state: "live",
      label: "Calculators available",
      detail: "Shopify profit, return loss, break-even, ACoS and ROAS calculators are available.",
      href: "/shopify-profit-calculator",
    },
    guideSlug: "shopify-profitability",
    calculatorSlugs: [
      "shopify-profit-calculator",
      "shopify-return-loss-calculator",
      "shopify-break-even-price",
      "shopify-acos-calculator",
      "shopify-ads-break-even-roas",
    ],
    primaryCta: { href: "/analyze", label: "Analyze Shopify files" },
    secondaryCta: { href: "/app/connections", label: "Open Connections" },
  },
  woocommerce: {
    id: "woocommerce",
    name: "WooCommerce",
    channelId: "woocommerce",
    logo: "/brands/marketplaces/woocommerce.svg",
    hubHref: "/marketplaces/woocommerce",
    summary: "Merchant-controlled read-only WooCommerce REST order sync with payout evidence kept separate.",
    fileAnalysis: {
      state: "not-available",
      label: "File analysis not claimed",
      detail: "SellerHisab does not currently claim a WooCommerce file analyzer for Profit Check.",
    },
    connection: {
      state: "available",
      label: "Read-only connection available",
      detail: "WooCommerce REST API wc/v3 order sync uses a public HTTPS store and merchant-generated Read credentials; no WordPress password is requested.",
      href: "/app/connections",
    },
    guides: {
      state: "live",
      label: "Guides available",
      detail: "WooCommerce order, gateway payout and profitability guidance is available.",
      href: "/guides/woocommerce-profitability",
    },
    calculators: {
      state: "live",
      label: "Calculators available",
      detail: "WooCommerce profit, return loss, break-even, ACoS and ROAS calculators are available using seller-entered payout and cost evidence.",
      href: "/woocommerce-profit-calculator",
    },
    guideSlug: "woocommerce-profitability",
    calculatorSlugs: [
      "woocommerce-profit-calculator",
      "woocommerce-return-loss-calculator",
      "woocommerce-break-even-price",
      "woocommerce-acos-calculator",
      "woocommerce-ads-break-even-roas",
    ],
    primaryCta: { href: "/app/connections", label: "Connect WooCommerce" },
    secondaryCta: { href: "/marketplaces/woocommerce", label: "Open WooCommerce hub" },
  },
};

export const PRIMARY_MARKETPLACE_IDS = ["meesho", "amazon", "flipkart", "shopify", "woocommerce"] as const;

export function marketplaceDefinition(id: string): MarketplaceDefinition | undefined {
  return (MARKETPLACE_DEFINITIONS as Record<string, MarketplaceDefinition>)[id];
}
