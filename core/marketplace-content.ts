import {
  guidePages as baseGuidePages,
  marketplaceHubs as baseMarketplaceHubs,
  type SeoContentConfig,
} from "./seo-hubs";

const meeshoHub: SeoContentConfig = {
  ...baseMarketplaceHubs.meesho,
  related: [
    { href: "/guides/meesho-profitability", label: "Meesho Profitability Guide" },
    { href: "/meesho-profit-calculator", label: "Meesho Profit Calculator" },
    { href: "/meesho-rto-calculator", label: "Meesho RTO Loss Calculator" },
    { href: "/analyze", label: "Analyze Meesho Files" },
  ],
};

const amazonHub: SeoContentConfig = {
  ...baseMarketplaceHubs.amazon,
  related: [
    { href: "/guides/amazon-india-profitability", label: "Amazon India Profitability Guide" },
    { href: "/amazon-profit-calculator", label: "Amazon Profit Calculator" },
    { href: "/amazon-break-even-price", label: "Amazon Break-even Price" },
    { href: "/app/connections", label: "Marketplace Connections" },
  ],
};

const flipkartHub: SeoContentConfig = {
  ...baseMarketplaceHubs.flipkart,
  related: [
    { href: "/guides/flipkart-profitability", label: "Flipkart Profitability Guide" },
    { href: "/flipkart-profit-calculator", label: "Flipkart Profit Calculator" },
    { href: "/flipkart-rto-calculator", label: "Flipkart RTO & Return Loss" },
    { href: "/app/connections", label: "Marketplace Connections" },
  ],
};

const shopifyHub: SeoContentConfig = {
  slug: "shopify",
  title: "Shopify Profit, Payout & Store Economics Hub",
  description: "SellerHisab guidance for Shopify Orders CSV, Shopify Payments evidence, contribution, refunds, ads and optional merchant-authorized Admin API read sync.",
  eyebrow: "Marketplace hub",
  headline: "Shopify revenue is not the same thing as the money your store finally keeps.",
  directAnswer: "SellerHisab keeps Shopify order value, payment/payout evidence and seller costs separate. Orders CSV plus supported Shopify Payments balance-transaction evidence can be analyzed by file. An optional Admin GraphQL read connection is available only after SellerHisab app configuration and merchant authorization.",
  sections: [
    {
      title: "File analysis works without OAuth",
      bullets: [
        "Supported Shopify Orders CSV can establish order-line evidence.",
        "Supported Shopify Payments balance-transactions evidence can establish attributable payout economics.",
        "Product cost, packaging and attributable ads remain seller-supplied where the source does not provide them.",
      ],
    },
    {
      title: "Official connection is optional",
      paragraphs: [
        "SellerHisab has an Admin GraphQL read-sync path, but a connection becomes usable only after app credentials are configured and the merchant completes Shopify authorization. Payment evidence through the API depends on the scopes Shopify actually grants to the app/store.",
      ],
    },
    {
      title: "Gateway reality still matters",
      paragraphs: [
        "If an order uses a payment gateway outside Shopify Payments, the order itself does not prove the final gateway payout. Use actual gateway or bank payout evidence before treating contribution as confirmed.",
      ],
    },
  ],
  related: [
    { href: "/guides/shopify-profitability", label: "Shopify Profitability Guide" },
    { href: "/shopify-profit-calculator", label: "Shopify Profit Calculator" },
    { href: "/shopify-break-even-price", label: "Shopify Break-even Price" },
    { href: "/app/connections", label: "Marketplace Connections" },
  ],
};

const woocommerceHub: SeoContentConfig = {
  slug: "woocommerce",
  title: "WooCommerce Profit, Orders & Payout Hub",
  description: "SellerHisab guidance for read-only WooCommerce order sync, gateway payout evidence, contribution, refunds and seller-entered cost analysis.",
  eyebrow: "Storefront hub",
  headline: "WooCommerce can prove the order. Your payment gateway still has to prove the payout.",
  directAnswer: "SellerHisab supports merchant-controlled WooCommerce REST API wc/v3 order read sync. It does not infer payment-gateway settlement from WooCommerce order totals and does not currently claim WooCommerce file analysis in Profit Check. For contribution, use actual gateway or bank payout evidence plus your known costs.",
  sections: [
    {
      title: "What the connection reads",
      bullets: [
        "Read-only WooCommerce order identity, status, date, currency and line-level SKU/quantity/line total.",
        "A public HTTPS store plus merchant-generated WooCommerce REST API Read credentials.",
        "No WordPress password, customer billing address, shipping address, phone or email is required for the finance mapper.",
      ],
    },
    {
      title: "What WooCommerce orders do not prove",
      paragraphs: [
        "An order total is not the same as the final payment-gateway payout. Gateway fees, refunds, chargebacks and payout timing can sit outside WooCommerce order evidence, so SellerHisab keeps that layer separate instead of inventing a settlement number.",
      ],
    },
    {
      title: "How to use the calculators",
      bullets: [
        "For the profit calculator, enter the actual gateway/bank net payout in the settlement field.",
        "Use observed refund/return loss rather than a hidden universal assumption.",
        "Use your own retained payout rate for break-even price instead of assuming one marketplace fee table.",
      ],
    },
  ],
  related: [
    { href: "/guides/woocommerce-profitability", label: "WooCommerce Profitability Guide" },
    { href: "/woocommerce-profit-calculator", label: "WooCommerce Profit Calculator" },
    { href: "/woocommerce-break-even-price", label: "WooCommerce Break-even Price" },
    { href: "/app/connections", label: "Connect WooCommerce" },
  ],
};

export const marketplaceHubs: Record<string, SeoContentConfig> = {
  meesho: meeshoHub,
  amazon: amazonHub,
  flipkart: flipkartHub,
  shopify: shopifyHub,
  woocommerce: woocommerceHub,
};

const marketplaceGuides: Record<string, SeoContentConfig> = {
  "meesho-profitability": {
    slug: "meesho-profitability",
    title: "Meesho Seller Profitability Guide",
    description: "A practical Meesho seller guide to settlement-led contribution, RTO/returns, SKU cost, ads and file-first analysis.",
    eyebrow: "Marketplace guide",
    headline: "Read Meesho profit from settlement evidence, not from sales alone.",
    directAnswer: "For Meesho, SellerHisab starts from supported payment/settlement evidence, adds SKU cost and other known variable costs, and keeps return/RTO effects visible. No general public seller API connection is claimed; the supported workflow is file-first.",
    sections: [
      {
        title: "Start with the right report",
        bullets: [
          "Use Payments or Payments to Date as the financial starting point.",
          "Add Orders when deeper order-state matching is needed.",
          "Add SKU cost before treating contribution as complete.",
        ],
      },
      {
        title: "Keep RTO and returns in money terms",
        paragraphs: ["A return or RTO percentage becomes useful when you connect it to observed economic loss per failed order and the contribution on successful orders."],
      },
      {
        title: "Use file-first tools",
        bullets: ["Profit Check for supported Meesho files.", "Profit, RTO, break-even, ACoS and ROAS calculators for quick scenario checks.", "Settlement and contribution guides for evidence review."],
      },
    ],
    related: [
      { href: "/marketplaces/meesho", label: "Meesho Seller Hub" },
      { href: "/meesho-profit-calculator", label: "Meesho Profit Calculator" },
      { href: "/meesho-rto-calculator", label: "Meesho RTO Calculator" },
      { href: "/analyze", label: "Analyze Meesho Files" },
    ],
  },
  "amazon-india-profitability": {
    slug: "amazon-india-profitability",
    title: "Amazon India Seller Profitability Guide",
    description: "Understand Amazon India orders, Settlement Flat File V2, contribution, returns, ads and optional SP-API read sync without mixing sales and payout evidence.",
    eyebrow: "Marketplace guide",
    headline: "Amazon orders show what sold. Settlement evidence shows what the economics actually retained.",
    directAnswer: "SellerHisab keeps Amazon order evidence and settlement/payout evidence separate. Supported file analysis works without SP-API. The optional SP-API read connection is implemented but remains dependent on SellerHisab app configuration, approved roles/scopes and seller authorization.",
    sections: [
      {
        title: "Use both order and settlement evidence",
        bullets: [
          "Orders export establishes order ID, SKU, quantity and item value.",
          "Settlement Flat File V2 establishes attributable marketplace financial events.",
          "Product cost and attributable ads are still required before a complete contribution claim.",
        ],
      },
      {
        title: "Treat API sync as optional",
        paragraphs: ["A seller can use file analysis even when no SP-API connection is active. API sync should only be shown as connected after the seller completes the official authorization flow and the required app roles/scopes are available."],
      },
      {
        title: "Use calculators for scenarios, not invented fees",
        bullets: ["Profit calculator from attributable settlement/payout and known costs.", "Return-loss calculator from observed failure economics.", "Break-even, ACoS and ROAS calculators from seller evidence."],
      },
    ],
    related: [
      { href: "/marketplaces/amazon", label: "Amazon India Hub" },
      { href: "/amazon-profit-calculator", label: "Amazon Profit Calculator" },
      { href: "/amazon-break-even-price", label: "Amazon Break-even Price" },
      { href: "/app/connections", label: "Marketplace Connections" },
    ],
  },
  "flipkart-profitability": {
    slug: "flipkart-profitability",
    title: "Flipkart Seller Profitability Guide",
    description: "Understand Flipkart order-item evidence, settlement/P&L files, return/RTO economics and optional seller-authorized order sync.",
    eyebrow: "Marketplace guide",
    headline: "Flipkart profit needs stable order-line identity and settlement evidence together.",
    directAnswer: "SellerHisab prefers stable Flipkart identifiers such as Order Item ID plus SKU when linking seller activity to financial evidence. File analysis is live for supported reports. Official Seller API order sync is optional and authorization-dependent; settlement remains validated-file-first.",
    sections: [
      {
        title: "Use the most specific stable identifier",
        bullets: ["Order Item ID is safer than a broad order total when one order has multiple lines.", "Seller SKU helps preserve product-level economics.", "Ambiguous mappings stay incomplete instead of being guessed."],
      },
      {
        title: "Keep settlement file-first",
        paragraphs: ["SellerHisab does not claim a live Flipkart settlement API in this workflow. Supported settlement/P&L evidence remains the financial source for deterministic reconciliation."],
      },
      {
        title: "Use return/RTO economics with contribution",
        paragraphs: ["A high failure rate is only part of the story. Compare observed loss per failed order with successful-order contribution before deciding whether to reprice, reduce ads or change fulfilment."],
      },
    ],
    related: [
      { href: "/marketplaces/flipkart", label: "Flipkart Seller Hub" },
      { href: "/flipkart-profit-calculator", label: "Flipkart Profit Calculator" },
      { href: "/flipkart-rto-calculator", label: "Flipkart RTO & Return Loss" },
      { href: "/app/connections", label: "Marketplace Connections" },
    ],
  },
  "shopify-profitability": {
    slug: "shopify-profitability",
    title: "Shopify Store Profitability Guide",
    description: "Understand Shopify orders, Shopify Payments or gateway payout evidence, refunds, ads and optional Admin API read sync.",
    eyebrow: "Storefront guide",
    headline: "Shopify sales become useful finance data only when payout and costs are attached.",
    directAnswer: "Supported Shopify Orders CSV plus Shopify Payments balance-transactions evidence can be analyzed by file. An optional Admin GraphQL read connection can sync orders after merchant authorization. If another payment gateway is used, actual gateway payout evidence still has to come from that gateway or the bank.",
    sections: [
      {
        title: "Separate orders from payouts",
        bullets: ["Orders establish what the customer bought.", "Shopify Payments evidence can establish net payment economics where supported.", "External gateways need their own payout evidence before contribution is confirmed."],
      },
      {
        title: "Track refunds with the same evidence window",
        paragraphs: ["Refund timing can cross periods, so a current-month order total and current-month bank payout do not always reconcile one-to-one. Keep unresolved refunds provisional until the relevant payout evidence arrives."],
      },
      {
        title: "Use ads against pre-ad contribution",
        bullets: ["ROAS alone does not prove profitability.", "Max ACoS should come from pre-ad contribution.", "Break-even price should use the observed retained payout rate from your own store economics."],
      },
    ],
    related: [
      { href: "/marketplaces/shopify", label: "Shopify Hub" },
      { href: "/shopify-profit-calculator", label: "Shopify Profit Calculator" },
      { href: "/shopify-ads-break-even-roas", label: "Shopify Break-even ROAS" },
      { href: "/app/connections", label: "Marketplace Connections" },
    ],
  },
  "woocommerce-profitability": {
    slug: "woocommerce-profitability",
    title: "WooCommerce Store Profitability Guide",
    description: "Understand WooCommerce order sync, gateway payout evidence, refunds, ads and contribution without treating order totals as bank settlement.",
    eyebrow: "Storefront guide",
    headline: "WooCommerce tells you the order. Your gateway and bank tell you the cash.",
    directAnswer: "SellerHisab supports read-only WooCommerce REST order sync but does not infer gateway settlement from order totals and does not claim a WooCommerce file analyzer in Profit Check. For contribution, pair WooCommerce order evidence with actual payment-gateway or bank payout evidence and seller-entered costs.",
    sections: [
      {
        title: "Connect with merchant-controlled Read access",
        bullets: ["Use a public HTTPS WooCommerce store.", "Generate WooCommerce REST API Consumer Key/Secret with Read permission.", "SellerHisab does not ask for the WordPress password."],
      },
      {
        title: "Keep gateway payout separate",
        paragraphs: ["Payment gateways can apply fees, refunds, chargebacks and payout timing that are not proven by the WooCommerce order object. Enter the actual net gateway/bank payout when using the contribution calculator."],
      },
      {
        title: "Use quick tools with explicit inputs",
        bullets: ["Profit calculator using actual payout plus known costs.", "Return/refund loss calculator using observed failure economics.", "Break-even, ACoS and ROAS calculators using your own retained rate and pre-ad contribution."],
      },
    ],
    related: [
      { href: "/marketplaces/woocommerce", label: "WooCommerce Hub" },
      { href: "/woocommerce-profit-calculator", label: "WooCommerce Profit Calculator" },
      { href: "/woocommerce-break-even-price", label: "WooCommerce Break-even Price" },
      { href: "/app/connections", label: "Connect WooCommerce" },
    ],
  },
};

export const guidePages: Record<string, SeoContentConfig> = {
  ...baseGuidePages,
  ...marketplaceGuides,
};
